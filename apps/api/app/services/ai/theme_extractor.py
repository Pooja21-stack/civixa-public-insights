"""
GPT-4o based theme extraction, urgency scoring, and evidence summarisation.

Pipeline per submission:
  1. Translate to English (handled upstream by translator.py)
  2. Call GPT-4o with a structured JSON prompt
  3. Parse + validate the response
  4. Return themes, urgency score, urgency level, and a short summary
"""
from __future__ import annotations
import json
import logging
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

THEME_KEYS = ["roads", "schools", "water", "health", "electricity", "other"]

SYSTEM_PROMPT = """You are an AI assistant helping analyse citizen development requests submitted to a Member of Parliament.

Given a citizen's submission text (already translated to English), you must:
1. Identify which development theme(s) the submission belongs to (pick 1–3 from the allowed list)
2. Assign an urgency score from 0.0 (very low urgency) to 1.0 (critical/life-threatening)
3. Classify urgency level as one of: low, medium, high, critical
4. Write a 1–2 sentence neutral summary suitable for the MP's dashboard

Allowed themes:
- roads       → roads, transport, bridges, footpaths, connectivity
- schools     → schools, education, teachers, classrooms, enrollment
- water       → water supply, sewage, drainage, sanitation, toilets
- health      → hospitals, health centres, doctors, medicines, ambulance
- electricity → power cuts, streetlights, transformers, electricity supply
- other       → anything that doesn't fit the above

Urgency scoring guide:
- critical (0.85–1.0): life/safety at immediate risk (closed hospital, dangerous structure)
- high     (0.65–0.84): significant hardship affecting daily life (8+ hour power cuts, no water for days)
- medium   (0.40–0.64): recurring problem with moderate impact
- low      (0.0–0.39):  improvement request, no immediate hardship

Respond ONLY with valid JSON in this exact schema:
{
  "themes": ["theme1", "theme2"],
  "urgency_score": 0.82,
  "urgency_level": "high",
  "summary": "One or two sentence neutral summary."
}"""


async def extract_themes(text: str) -> dict:
    """
    Calls GPT-4o to extract themes and urgency from the given (English) text.

    Returns:
        {
            "themes": ["schools", "roads"],
            "urgency_score": 0.82,
            "urgency_level": "high",
            "summary": "Resident reports school too far and road in poor condition."
        }

    Falls back to a safe default on any OpenAI error so submission ingestion never fails.
    """
    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — returning default theme extraction")
        return _fallback(text)

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": f"Citizen submission:\n\n{text}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,       # low temperature for consistent structured output
            max_tokens=300,
        )

        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)
        return _validate(result, text)

    except json.JSONDecodeError as e:
        logger.error("GPT-4o returned invalid JSON: %s", e)
        return _fallback(text)
    except Exception as e:
        logger.error("GPT-4o theme extraction failed: %s", e)
        return _fallback(text)


def _validate(result: dict, original_text: str) -> dict:
    """Sanitise GPT output — ensure all required fields are present and valid."""
    themes = [t for t in result.get("themes", []) if t in THEME_KEYS]
    if not themes:
        themes = ["other"]

    urgency_score = float(result.get("urgency_score", 0.5))
    urgency_score = max(0.0, min(1.0, urgency_score))

    urgency_level = result.get("urgency_level", "medium")
    if urgency_level not in ("low", "medium", "high", "critical"):
        urgency_level = _score_to_level(urgency_score)

    summary = str(result.get("summary", original_text[:200])).strip()

    return {
        "themes": themes,
        "urgency_score": round(urgency_score, 4),
        "urgency_level": urgency_level,
        "summary": summary,
    }


def _fallback(text: str) -> dict:
    return {
        "themes": ["other"],
        "urgency_score": 0.5,
        "urgency_level": "medium",
        "summary": text[:200],
    }


def _score_to_level(score: float) -> str:
    if score >= 0.85:
        return "critical"
    if score >= 0.65:
        return "high"
    if score >= 0.40:
        return "medium"
    return "low"
