"""
Audio transcription — local, free, no API key.

Strategy (in priority order):
  1. faster-whisper  — pure Python, runs on CPU, good accuracy (recommended)
  2. whisper         — openai-whisper package, CPU mode (fallback)
  3. Stub fallback   — returns empty string, submission still accepted as text

Install faster-whisper (recommended):
    pip install faster-whisper

Or the whisper fallback:
    pip install openai-whisper   # the openai-whisper package — runs 100% locally

Both run 100% locally — no internet, no API key, no cost.
Model sizes (tradeoff: speed vs accuracy):
  tiny   (~40 MB)  — fastest, good for demo
  base   (~75 MB)  — good balance  ← default
  small  (~245 MB) — better accuracy
"""
from __future__ import annotations
import io
import logging
import tempfile
import os
from app.core.config import settings

logger = logging.getLogger(__name__)

_LANG_MAP: dict[str, str] = {
    "hindi": "hi", "marathi": "mr", "tamil": "ta", "telugu": "te",
    "kannada": "kn", "gujarati": "gu", "bengali": "bn", "punjabi": "pa",
    "urdu": "ur", "english": "en", "malayalam": "ml", "odia": "or",
}


def _normalise_lang(lang: str) -> str:
    lang_lower = lang.lower().strip()
    if len(lang_lower) <= 3:
        return lang_lower
    return _LANG_MAP.get(lang_lower, lang_lower[:2])


def _transcribe_faster_whisper(audio_bytes: bytes, filename: str) -> dict:
    """Transcribe using faster-whisper (CPU-only, no GPU needed)."""
    from faster_whisper import WhisperModel

    model_size = settings.WHISPER_CPP_MODEL  # "tiny", "base", "small"
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    # Write to temp file (faster-whisper needs a file path)
    suffix = f".{filename.rsplit('.', 1)[-1]}" if "." in filename else ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(tmp_path, beam_size=3)
        text = " ".join(seg.text.strip() for seg in segments).strip()
        lang = _normalise_lang(info.language or "en")
        logger.info("faster-whisper: %d chars, lang=%s", len(text), lang)
        return {"text": text, "lang": lang}
    finally:
        os.unlink(tmp_path)


def _transcribe_whisper(audio_bytes: bytes, filename: str) -> dict:
    """Transcribe using the original openai-whisper package (CPU mode)."""
    import whisper
    import numpy as np

    model = whisper.load_model(settings.WHISPER_CPP_MODEL)

    suffix = f".{filename.rsplit('.', 1)[-1]}" if "." in filename else ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = model.transcribe(tmp_path)
        text = result.get("text", "").strip()
        lang = _normalise_lang(result.get("language", "en"))
        logger.info("whisper: %d chars, lang=%s", len(text), lang)
        return {"text": text, "lang": lang}
    finally:
        os.unlink(tmp_path)


async def transcribe_audio(file_bytes: bytes, filename: str) -> dict:
    """
    Transcribe audio locally — no API key needed.

    Tries faster-whisper first, then whisper, then returns empty string.

    Returns:
        {"text": "transcribed text", "lang": "hi"}
    """
    if not file_bytes:
        return {"text": "", "lang": "en"}

    import asyncio
    loop = asyncio.get_event_loop()

    # Try faster-whisper
    try:
        result = await loop.run_in_executor(
            None, _transcribe_faster_whisper, file_bytes, filename
        )
        return result
    except ImportError:
        logger.info("faster-whisper not installed, trying whisper...")
    except Exception as e:
        logger.warning("faster-whisper failed: %s — trying whisper", e)

    # Try original whisper
    try:
        result = await loop.run_in_executor(
            None, _transcribe_whisper, file_bytes, filename
        )
        return result
    except ImportError:
        logger.warning(
            "No local whisper installed. Install with: pip install faster-whisper\n"
            "Voice submissions will be accepted but not transcribed."
        )
    except Exception as e:
        logger.error("whisper failed: %s", e)

    return {"text": "", "lang": "en"}
