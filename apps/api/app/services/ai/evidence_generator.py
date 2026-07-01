"""
Evidence generator using Ollama (local, free, no API key).

Produces human-readable evidence cards for the MP dashboard.
Uses the same local Ollama model as theme_extractor.py.
Falls back to a template-based string if Ollama is unavailable.
"""
from __future__ import annotations
import json
import logging
import urllib.request
import urllib.error
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an AI analyst writing evidence summaries for an MP's constituency development dashboard.

Given structured data about a development project — citizen demand, infrastructure gaps, and development plan excerpts — write a concise 2-4 sentence evidence summary that:
1. States the key citizen demand (number of submissions, urgency)
2. Quantifies the infrastructure gap (distance to facility, affected population)
3. References any development plan content if provided
4. Ends with a clear action signal

Tone: factual, neutral, data-driven. Suitable for an MP briefing. No jargon.
Respond with ONLY the evidence paragraph — no labels, no JSON."""


def _call_ollama_evidence(user_message: str) -> str | None:
    payload = json.dumps({
        "model":   settings.OLLAMA_MODEL,
        "stream":  False,
        "options": {"temperature": 0.3, "num_predict": 300},
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
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
            return body["message"]["content"].strip()
    except Exception as e:
        logger.error("Ollama evidence generation failed: %s", e)
        return None


async def generate_evidence(
    project_title: str,
    theme: str,
    ward_name: str,
    submission_count: int,
    urgency_level: str,
    urgency_score: float,
    demand_score: float,
    gap_score: float,
    priority_rank: int,
    ward_data: Optional[dict] = None,
    rag_context: Optional[list[dict]] = None,
    sample_submissions: Optional[list[str]] = None,
) -> str:
    """Generate evidence text using Ollama. Falls back to template if unavailable."""
    user_message = _build_user_message(
        project_title, theme, ward_name, submission_count,
        urgency_level, urgency_score, demand_score, gap_score,
        priority_rank, ward_data, rag_context, sample_submissions,
    )

    import asyncio
    loop = asyncio.get_event_loop()
    evidence = await loop.run_in_executor(None, _call_ollama_evidence, user_message)

    if not evidence:
        logger.warning("Ollama unavailable — using template evidence")
        return _template_evidence(
            project_title, theme, ward_name, submission_count,
            urgency_level, ward_data, rag_context,
        )

    return evidence


async def generate_evidence_batch(projects: list[dict], ward_lookup: dict) -> list[dict]:
    """Generate evidence for a list of projects. Updates each dict in-place."""
    for project in projects:
        ward_id   = project.get("ward_id")
        ward_data = ward_lookup.get(ward_id, {})
        project["evidence_text"] = await generate_evidence(
            project_title    = project.get("title", ""),
            theme            = project.get("theme", "other"),
            ward_name        = ward_data.get("name", ward_id or "Unknown Ward"),
            submission_count = project.get("submission_count", 0),
            urgency_level    = project.get("urgency_level", "medium"),
            urgency_score    = project.get("urgency_score", 0.5),
            demand_score     = project.get("demand_score",  0.0),
            gap_score        = project.get("gap_score",     0.0),
            priority_rank    = project.get("priority_rank", 0),
            ward_data        = ward_data,
            rag_context      = project.get("rag_context"),
            sample_submissions = project.get("sample_submissions"),
        )
    return projects


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _build_user_message(
    project_title, theme, ward_name, submission_count,
    urgency_level, urgency_score, demand_score, gap_score,
    priority_rank, ward_data, rag_context, sample_submissions,
) -> str:
    lines = [
        f"Project: {project_title}",
        f"Theme: {theme}  |  Ward: {ward_name}  |  Priority rank: #{priority_rank}",
        f"Citizen submissions: {submission_count}",
        f"Urgency: {urgency_level} ({urgency_score:.2f})  |  Demand score: {demand_score:.2f}  |  Gap score: {gap_score:.2f}",
    ]
    if ward_data:
        pop        = ward_data.get("population", 0)
        school_km  = ward_data.get("nearest_school_km")
        hosp_km    = ward_data.get("nearest_hospital_km")
        school_age = ward_data.get("school_age_population")
        if pop:        lines.append(f"Ward population: {pop:,}")
        if school_age: lines.append(f"School-age children: {school_age:,}")
        if school_km:  lines.append(f"Nearest school: {school_km} km")
        if hosp_km:    lines.append(f"Nearest hospital: {hosp_km} km")

    if sample_submissions:
        lines.append("\nSample citizen submissions:")
        for i, s in enumerate(sample_submissions[:3], 1):
            lines.append(f'  {i}. "{s[:200]}"')

    if rag_context:
        lines.append("\nRelevant development plan excerpts:")
        for ctx in rag_context[:2]:
            chunk = ctx.get("chunk", "")[:300]
            title = ctx.get("metadata", {}).get("title", "Development Plan")
            lines.append(f'  [{title}] "{chunk}"')

    return "\n".join(lines)


def _template_evidence(
    project_title, theme, ward_name, submission_count,
    urgency_level, ward_data, rag_context,
) -> str:
    """Template fallback — always produces readable output, no model needed."""
    theme_labels = {
        "schools": "school infrastructure", "roads": "road conditions",
        "water": "water supply", "health": "healthcare access",
        "electricity": "electricity supply", "other": "development needs",
    }
    label = theme_labels.get(theme, theme)
    parts = [
        f"{submission_count} citizen submission{'s' if submission_count != 1 else ''} "
        f"from {ward_name} identified {label} as a {urgency_level}-urgency need."
    ]
    if ward_data:
        if theme == "schools":
            km  = ward_data.get("nearest_school_km")
            pop = ward_data.get("school_age_population")
            if km and km > 2:
                parts.append(
                    f"The nearest school is {km} km away, creating a significant access gap"
                    + (f" for the ward's {pop:,} school-age children." if pop else ".")
                )
        elif theme == "health":
            km = ward_data.get("nearest_hospital_km")
            if km and km > 5:
                parts.append(f"The nearest health facility is {km} km away, leaving residents without accessible emergency care.")
    if rag_context:
        title = rag_context[0].get("metadata", {}).get("title", "the local development plan")
        parts.append(f"This aligns with provisions identified in {title}.")
    parts.append("Addressing this project would directly improve quality of life for the affected population.")
    return " ".join(parts)
