"""
Whisper-based audio transcription.

Sends an audio file to OpenAI Whisper API and returns the transcribed text
along with the detected language code.
"""
from __future__ import annotations
import io
import logging
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

# Whisper supports these audio formats
SUPPORTED_MIME = {
    "webm": "audio/webm",
    "mp3":  "audio/mpeg",
    "mp4":  "audio/mp4",
    "m4a":  "audio/m4a",
    "wav":  "audio/wav",
    "ogg":  "audio/ogg",
}


async def transcribe_audio(file_bytes: bytes, filename: str) -> dict:
    """
    Transcribes an audio file using OpenAI Whisper.

    Args:
        file_bytes: Raw audio bytes
        filename:   Original filename (used to determine format extension)

    Returns:
        {
            "text": "transcribed text string",
            "lang": "hi"   # ISO 639-1 language code detected by Whisper
        }

    Falls back to empty string on any error so ingestion never fails.
    """
    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — skipping transcription")
        return {"text": "", "lang": "en"}

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
    mime = SUPPORTED_MIME.get(ext, "audio/webm")

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    try:
        audio_file = io.BytesIO(file_bytes)
        audio_file.name = filename  # OpenAI SDK reads .name to infer format

        response = await client.audio.transcriptions.create(
            model=settings.WHISPER_MODEL,
            file=(filename, audio_file, mime),
            response_format="verbose_json",  # returns language detection too
        )

        text = response.text.strip()
        lang = getattr(response, "language", "en") or "en"

        # Whisper returns full language names (e.g. "hindi") — normalise to ISO codes
        lang = _normalise_lang(lang)

        logger.info("Whisper transcribed %d bytes → %d chars, lang=%s", len(file_bytes), len(text), lang)
        return {"text": text, "lang": lang}

    except Exception as e:
        logger.error("Whisper transcription failed: %s", e)
        return {"text": "", "lang": "en"}


# Whisper returns full English names — map the most common ones to ISO 639-1
_LANG_MAP: dict[str, str] = {
    "hindi":      "hi",
    "marathi":    "mr",
    "tamil":      "ta",
    "telugu":     "te",
    "kannada":    "kn",
    "gujarati":   "gu",
    "bengali":    "bn",
    "punjabi":    "pa",
    "urdu":       "ur",
    "english":    "en",
    "malayalam":  "ml",
    "odia":       "or",
}


def _normalise_lang(lang: str) -> str:
    lang_lower = lang.lower().strip()
    # Already an ISO code (2–3 chars)
    if len(lang_lower) <= 3:
        return lang_lower
    return _LANG_MAP.get(lang_lower, lang_lower[:2])
