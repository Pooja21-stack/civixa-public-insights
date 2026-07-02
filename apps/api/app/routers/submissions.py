from __future__ import annotations
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.submission import SubmissionResponse, SubmissionListResponse
from app.services import submission_service
from app.workers.tasks import process_submission

logger = logging.getLogger(__name__)
router = APIRouter()


# ── POST /submissions — public (citizens submit without login) ─────────────────
# Valid theme keys — must match the frontend ThemeKey type
_VALID_THEMES = {"roads", "schools", "water", "health", "electricity", "other"}


@router.post("", response_model=SubmissionResponse, status_code=201)
async def create_submission(
    text_raw: str                    = Form(...),
    channel:  str                    = Form("web"),
    lat:      Optional[float]        = Form(None),
    lng:      Optional[float]        = Form(None),
    ward_id:  Optional[str]          = Form(None),
    lang:     Optional[str]          = Form(None),
    theme:    Optional[str]          = Form(None),   # citizen-selected category hint
    media:    Optional[UploadFile]   = File(None),
    db:       AsyncSession           = Depends(get_db),
):
    """
    Accept a new citizen submission.

    - Detects language and translates to English synchronously so the result
      is immediately visible on the dashboard (no Celery dependency for this step).
    - Persists the submission including translation + lang_detected.
    - Fires a Celery background task for deeper AI enrichment (theme extraction, scoring).
    """
    from app.services.ai.translator import detect_and_translate

    media_urls: list[str] = []

    if media and media.size and media.size > 0:
        try:
            import os, aiofiles
            upload_dir = "uploads"
            os.makedirs(upload_dir, exist_ok=True)
            filename = f"{media.filename}"
            filepath = os.path.join(upload_dir, filename)
            async with aiofiles.open(filepath, "wb") as f:
                content = await media.read()
                await f.write(content)
            media_urls.append(filepath)
        except Exception as e:
            logger.warning("Media upload failed: %s", e)

    # ── Synchronous language detection + translation ──────────────────────────
    # Run detect_and_translate now so text_translated is stored immediately.
    # The citizen-selected lang hint is used as the source if provided,
    # otherwise auto-detection kicks in.
    try:
        translation = detect_and_translate(text_raw)
        detected_lang     = translation["lang_detected"]
        text_translated   = translation["text_translated"]
        # If the citizen explicitly said which language they used, trust it
        # (detection on short texts can be wrong)
        if lang and lang not in ("en", "auto", ""):
            detected_lang = lang
    except Exception as e:
        logger.warning("Inline translation failed: %s", e)
        detected_lang   = lang or "en"
        text_translated = text_raw  # fallback: store raw as translated

    # Validate and normalise the citizen-selected theme
    theme_hint: list[str] = []
    if theme and theme.strip() and theme.strip() in _VALID_THEMES:
        theme_hint = [theme.strip()]

    submission = await submission_service.create_submission(
        db              = db,
        text_raw        = text_raw,
        channel         = channel,
        lat             = lat,
        lng             = lng,
        ward_id         = ward_id,
        lang            = detected_lang,
        text_translated = text_translated,
        media_urls      = media_urls,
        theme_hint      = theme_hint,
    )
    await db.commit()

    # Fire async AI processing for deeper enrichment (themes, urgency scoring)
    try:
        process_submission.delay(submission.id)
    except Exception as e:
        # Celery not running — translation is already done, only scoring is deferred
        logger.warning("Could not queue AI task (scoring deferred): %s", e)

    return submission


# ── Staff / MP / Admin — protected read endpoints ─────────────────────────────
@router.get("", response_model=SubmissionListResponse)
async def list_submissions(
    page:     int           = Query(1, ge=1),
    per_page: int           = Query(20, ge=1, le=100),
    theme:    Optional[str] = Query(None, description="Filter by theme key"),
    ward_id:  Optional[str] = Query(None, description="Filter by ward ID"),
    db:       AsyncSession  = Depends(get_db),
    _user:    User          = Depends(require_role("staff", "mp", "admin")),
):
    """Return a paginated list of submissions. Requires staff / mp / admin role."""
    return await submission_service.list_submissions(
        db=db, page=page, per_page=per_page, theme=theme, ward_id=ward_id,
    )


@router.get("/hotspots")
async def get_hotspots(
    db:    AsyncSession = Depends(get_db),
    _user: User         = Depends(require_role("staff", "mp", "admin")),
):
    """GeoJSON heatmap — requires staff / mp / admin role."""
    return await submission_service.get_hotspots(db)


@router.get("/{submission_id}", response_model=SubmissionResponse)
async def get_submission(
    submission_id: str,
    db:    AsyncSession = Depends(get_db),
    _user: User         = Depends(require_role("staff", "mp", "admin")),
):
    """Return a single submission by ID. Requires staff / mp / admin role."""
    from app.models.submission import Submission as Sub
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Sub).where(Sub.id == submission_id))
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission
