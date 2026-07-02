"""
WhatsApp webhook — receives Twilio inbound messages, persists them as Submissions,
fires the AI pipeline, and sends a localised acknowledgement reply.

Flow:
  POST /api/v1/webhooks/whatsapp
    ← Twilio sends form-encoded body with Body, From, MediaUrl0, Latitude, Longitude
    → Persist Submission (channel=whatsapp)
    → Queue process_submission Celery task
    → Reply with TwiML <Message>
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.twiml.messaging_response import MessagingResponse

from app.core.config import settings
from app.core.database import get_db
from app.services import submission_service
from app.workers.tasks import process_submission

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Multilingual acknowledgement messages ─────────────────────────────────────
_ACK = {
    "en": "✅ Thank you! We've received your development suggestion and will review it shortly.",
    "hi": "✅ धन्यवाद! हमने आपका सुझाव प्राप्त कर लिया है और जल्द ही समीक्षा करेंगे।",
    "ta": "✅ நன்றி! உங்கள் வளர்ச்சி பரிந்துரையை நாங்கள் பெற்றோம், விரைவில் ஆய்வு செய்வோம்.",
    "te": "✅ ధన్యవాదాలు! మీ అభివృద్ధి సూచనను మేము స్వీకరించాము, త్వరలో సమీక్షిస్తాము.",
    "mr": "✅ धन्यवाद! आम्हाला तुमची विकास सूचना मिळाली आहे, लवकरच आढावा घेऊ.",
    "bn": "✅ ধন্যবাদ! আমরা আপনার উন্নয়ন পরামর্শ পেয়েছি এবং শীঘ্রই পর্যালোচনা করব।",
    "gu": "✅ આભાર! અમને તમારો વિકાસ સૂચન મળ્યો છે, ટૂંક સમયમાં સમીક્ષા કરીશું.",
    "kn": "✅ ಧನ್ಯವಾದ! ನಿಮ್ಮ ಅಭಿವೃದ್ಧಿ ಸಲಹೆ ನಮಗೆ ಸಿಕ್ಕಿದೆ, ಶೀಘ್ರದಲ್ಲಿ ಪರಿಶೀಲಿಸುತ್ತೇವೆ.",
    "ml": "✅ നന്ദി! നിങ്ങളുടെ വികസന നിർദ്ദേശം ലഭിച്ചു, ഉടൻ അവലോകനം ചെയ്യുന്നതാണ്.",
    "pa": "✅ ਧੰਨਵਾਦ! ਅਸੀਂ ਤੁਹਾਡਾ ਵਿਕਾਸ ਸੁਝਾਅ ਪ੍ਰਾਪਤ ਕਰ ਲਿਆ ਹੈ, ਜਲਦੀ ਸਮੀਖਿਆ ਕਰਾਂਗੇ।",
}

_HELP_TEXT = (
    "📋 *CivIxa Public Insights*\n\n"
    "Send your development suggestion for your constituency in any language.\n\n"
    "Examples:\n"
    "• 'The road in Ward 5 has potholes'\n"
    "• 'We need more classrooms in the government school'\n"
    "• 'Drainage system is broken near the market'\n\n"
    "_Your message will be reviewed by your MP's office._"
)


def _verify_twilio_signature(request_url: str, params: dict, signature: str) -> bool:
    """Validate Twilio X-Twilio-Signature to prevent spoofed webhooks."""
    auth_token = settings.TWILIO_AUTH_TOKEN
    if not auth_token:
        # No token configured — allow through (dev mode)
        return True
    s = request_url + "".join(f"{k}{v}" for k, v in sorted(params.items()))
    import base64
    digest = hmac.new(auth_token.encode(), s.encode(), hashlib.sha1).digest()
    expected = base64.b64encode(digest).decode()
    return hmac.compare_digest(expected, signature or "")


def _detect_lang_fast(text: str) -> str:
    """Quick language detection for selecting ACK message — does not block on heavy libs."""
    try:
        from langdetect import detect
        lang = detect(text)
        return lang if lang in _ACK else "en"
    except Exception:
        return "en"


def _twiml_reply(message: str) -> Response:
    resp = MessagingResponse()
    resp.message(message)
    return Response(content=str(resp), media_type="application/xml")


@router.post("/whatsapp")
async def whatsapp_webhook(
    request: Request,
    x_twilio_signature: Optional[str] = Header(None, alias="X-Twilio-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Twilio inbound WhatsApp message webhook.

    Expects form-encoded body with at minimum:
      Body        — message text
      From        — sender WhatsApp number (e.g. whatsapp:+919876543210)
      MediaUrl0   — optional media attachment URL
      Latitude    — optional GPS lat
      Longitude   — optional GPS lng
    """
    form = await request.form()
    body_text: str = form.get("Body", "").strip()
    from_number: str = form.get("From", "")
    media_url: str = form.get("MediaUrl0", "")
    raw_lat = form.get("Latitude")
    raw_lng = form.get("Longitude")

    lat: Optional[float] = float(raw_lat) if raw_lat else None
    lng: Optional[float] = float(raw_lng) if raw_lng else None

    logger.info("WhatsApp inbound from=%s body_len=%d", from_number, len(body_text))

    # ── Twilio signature verification (skipped in dev if token not set) ────────
    if settings.TWILIO_AUTH_TOKEN:
        full_url = str(request.url)
        params = dict(form)
        if not _verify_twilio_signature(full_url, params, x_twilio_signature or ""):
            logger.warning("Invalid Twilio signature from %s", from_number)
            raise HTTPException(status_code=403, detail="Invalid Twilio signature")

    # ── Help / empty message ───────────────────────────────────────────────────
    if not body_text or body_text.lower() in {"help", "hi", "hello", "start", "menu"}:
        return _twiml_reply(_HELP_TEXT)

    # ── Detect language + translate synchronously ─────────────────────────────
    media_urls = [media_url] if media_url else []
    lang = _detect_lang_fast(body_text)

    text_translated = body_text  # default: same as raw (English or unknown)
    try:
        from app.services.ai.translator import detect_and_translate
        result = detect_and_translate(body_text)
        lang             = result["lang_detected"]
        text_translated  = result["text_translated"]
    except Exception as e:
        logger.warning("WhatsApp inline translation failed: %s", e)

    # ── Persist as a Submission ────────────────────────────────────────────────
    try:
        submission = await submission_service.create_submission(
            db=db,
            text_raw=body_text,
            channel="whatsapp",
            lat=lat,
            lng=lng,
            ward_id=None,   # geo-resolved async or manually later
            lang=lang,
            text_translated=text_translated,
            media_urls=media_urls,
            submitter_phone=from_number,
        )
        await db.commit()
    except Exception as e:
        logger.error("Failed to persist WhatsApp submission: %s", e)
        return _twiml_reply(
            "⚠️ Sorry, we couldn't save your message right now. Please try again in a moment."
        )

    # ── Fire async AI processing ───────────────────────────────────────────────
    try:
        process_submission.delay(submission.id)
    except Exception as e:
        logger.warning("Could not queue AI task for WhatsApp submission: %s", e)

    # ── Localised acknowledgement ──────────────────────────────────────────────
    ack = _ACK.get(lang, _ACK["en"])
    return _twiml_reply(ack)


@router.get("/whatsapp/health")
async def whatsapp_health():
    """Simple health check for Twilio webhook configuration."""
    return {
        "status": "ok",
        "twilio_configured": bool(settings.TWILIO_AUTH_TOKEN and settings.TWILIO_ACCOUNT_SID),
        "from_number": settings.TWILIO_WHATSAPP_FROM,
    }
