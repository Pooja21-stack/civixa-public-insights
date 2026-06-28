"""Whisper-based audio transcription — full implementation in AI pipeline step."""
from app.core.config import settings


async def transcribe_audio(file_bytes: bytes, filename: str) -> dict:
    """
    Returns:
      { "text": "...", "lang": "hi" }
    """
    # Placeholder — wired in AI pipeline step
    return {"text": "", "lang": "en"}
