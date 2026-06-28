"""GPT-4o based theme extraction — full implementation in AI pipeline step."""
from app.core.config import settings

THEME_KEYS = ["roads", "schools", "water", "health", "electricity", "other"]


async def extract_themes(text: str) -> dict:
    """
    Returns:
      {
        "themes": ["schools", "roads"],
        "urgency_score": 0.8,
        "urgency_level": "high",
        "summary": "Resident reports school too far..."
      }
    """
    # Placeholder — wired in AI pipeline step
    return {
        "themes": ["other"],
        "urgency_score": 0.5,
        "urgency_level": "medium",
        "summary": text[:200]
    }
