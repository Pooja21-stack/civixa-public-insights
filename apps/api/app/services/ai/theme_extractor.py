"""
Theme extraction using Ollama (local, free, no API key).

Uses mistral (or any model pulled via `ollama pull`) with JSON-format output.
Falls back gracefully if Ollama is not running.

Switch model:  set OLLAMA_MODEL=llama3 in apps/api/.env
"""
from __future__ import annotations
import json
import logging
import urllib.request
import urllib.error
from app.core.config import settings

logger = logging.getLogger(__name__)

THEME_KEYS = ["roads", "schools", "water", "health", "electricity", "other"]

SYSTEM_PROMPT = """You classify citizen development requests submitted to a Member of Parliament.

Given a citizen submission (in English), respond ONLY with a JSON object using this exact schema:
{
  "themes": ["theme1"],
  "urgency_score": 0.82,
  "urgency_level": "high",
  "summary": "One sentence neutral summary."
}

Rules:
- themes: pick 1-3 from ONLY these values: roads, schools, water, health, electricity, other
- urgency_score: float between 0.0 and 1.0
- urgency_level: exactly one of: low, medium, high, critical
- summary: 1-2 sentences, neutral, factual

Urgency guide:
- critical (0.85-1.0): life/safety risk (closed hospital, dangerous structure)
- high     (0.65-0.84): significant hardship (8+ hour power cuts, no water for days)
- medium   (0.40-0.64): recurring problem with moderate impact
- low      (0.0-0.39):  improvement request, no immediate hardship"""


def _call_ollama(text: str) -> dict | None:
    """
    Synchronous HTTP call to Ollama /api/chat endpoint.
    Returns parsed dict or None on failure.
    """
    payload = json.dumps({
        "model":   settings.OLLAMA_MODEL,
        "stream":  False,
        "format":  "json",
        "options": {"temperature": 0.1, "num_predict": 250},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": f"Citizen submission:\n\n{text}"},
        ],
    }).encode()

    req = urllib.request.Request(
        f"{settings.OLLAMA_BASE_URL}/api/chat",
        data    = payload,
        headers = {"Content-Type": "application/json"},
        method  = "POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=settings.OLLAMA_TIMEOUT) as resp:
            body = json.loads(resp.read().decode())
            return json.loads(body["message"]["content"])
    except urllib.error.URLError as e:
        logger.error("Ollama not reachable at %s — is it running? (%s)", settings.OLLAMA_BASE_URL, e)
        return None
    except (json.JSONDecodeError, KeyError) as e:
        logger.error("Ollama returned unexpected response: %s", e)
        return None
    except Exception as e:
        logger.error("Ollama call failed: %s", e)
        return None


async def extract_themes(text: str) -> dict:
    """
    Extract themes + urgency from English text using local Ollama LLM.

    Returns:
        {
            "themes": ["schools", "roads"],
            "urgency_score": 0.82,
            "urgency_level": "high",
            "summary": "Resident reports school too far."
        }
    Falls back to safe defaults if Ollama is unavailable.
    """
    if not text or not text.strip():
        return _fallback(text)

    # Run synchronous HTTP call (Ollama has no async SDK, but it's fast locally)
    import asyncio
    loop = asyncio.get_event_loop()
    raw = await loop.run_in_executor(None, _call_ollama, text)

    if raw is None:
        logger.warning("Ollama unavailable — using fallback theme extraction")
        return _fallback(text)

    return _validate(raw, text)


def _validate(result: dict, original_text: str) -> dict:
    """Sanitise Ollama output — ensure all fields are present and valid."""
    themes = [t for t in result.get("themes", []) if t in THEME_KEYS]
    if not themes:
        themes = ["other"]

    # Ollama sometimes returns 0–10 scale instead of 0–1
    raw_score = float(result.get("urgency_score", 0.5))
    if raw_score > 1.0:
        raw_score = raw_score / 10.0
    urgency_score = round(max(0.0, min(1.0, raw_score)), 4)

    urgency_level = result.get("urgency_level", "medium")
    if urgency_level not in ("low", "medium", "high", "critical"):
        urgency_level = _score_to_level(urgency_score)

    summary = str(result.get("summary", original_text[:200])).strip()

    return {
        "themes":        themes,
        "urgency_score": urgency_score,
        "urgency_level": urgency_level,
        "summary":       summary,
    }


def _fallback(text: str) -> dict:
    return {
        "themes":        ["other"],
        "urgency_score": 0.5,
        "urgency_level": "medium",
        "summary":       (text or "")[:200],
    }


def _score_to_level(score: float) -> str:
    if score >= 0.85: return "critical"
    if score >= 0.65: return "high"
    if score >= 0.40: return "medium"
    return "low"
