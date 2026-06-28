"""
Evidence generator — GPT-4o produces a human-readable justification for
why a project is ranked at its current priority position.

This is what appears on the MP dashboard "AI Evidence" card:

  "47 submissions in Ward 3 cite school access as critical.
   Ward has 5,800 school-age children but the nearest school is
   6.2 km away — well above the safe-walk threshold. The local
   development plan (Ward 3 Master Plan 2024) includes a reserved
   plot in sector 7B for educational infrastructure."

It combines:
  - Citizen demand data  (submission count, urgency, sample quotes)
  - Infrastructure gap   (ward demographics + distance metrics)
  - Development plan context  (retrieved via RAG from ingested PDFs)

Fallback
--------
If no API key is set, a template-based evidence string is generated
from the input data — always produces readable output.
"""
from __future__ import annotations

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─── System prompt ────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an AI analyst producing evidence summaries for an MP's constituency development dashboard.

Given structured data about a development project — including citizen demand, infrastructure gaps, and relevant excerpts from local development plans — write a concise 2–4 sentence evidence summary that:

1. States the key citizen demand (number of submissions, urgency level)
2. Quantifies the infrastructure gap (distance to nearest facility, affected population)
3. References any relevant development plan content if provided
4. Ends with a clear action signal ("This project should be prioritised because...")

Tone: factual, neutral, data-driven. No jargon. Suitable for an MP briefing document.

Respond with ONLY the evidence paragraph — no labels, no JSON, no extra text."""


# ─── Main function ────────────────────────────────────────────────────────────

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
    """
    Generate a human-readable evidence string for a priority project.

    Args:
        project_title:      e.g. "New Primary School — Ward 3 East"
        theme:              e.g. "schools"
        ward_name:          e.g. "Ward 3 — East"
        submission_count:   Total citizen submissions for this (theme, ward)
        urgency_level:      "low" | "medium" | "high" | "critical"
        urgency_score:      float 0–1
        demand_score:       float 0–1
        gap_score:          float 0–1
        priority_rank:      int (1 = highest priority)
        ward_data:          Dict with population, nearest_school_km, etc.
        rag_context:        Retrieved chunks from dev plan documents
        sample_submissions: Up to 3 raw citizen submission texts

    Returns:
        Evidence paragraph string.
    """
    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — using template evidence")
        return _template_evidence(
            project_title, theme, ward_name, submission_count,
            urgency_level, ward_data, rag_context,
        )

    user_message = _build_user_message(
        project_title, theme, ward_name, submission_count,
        urgency_level, urgency_score, demand_score, gap_score,
        priority_rank, ward_data, rag_context, sample_submissions,
    )

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    try:
        response = await client.chat.completions.create(
            model       = settings.OPENAI_MODEL,
            messages    = [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": user_message},
            ],
            temperature = 0.3,
            max_tokens  = 250,
        )
        evidence = response.choices[0].message.content or ""
        evidence = evidence.strip()
        logger.info("Generated evidence for '%s' (%d chars)", project_title, len(evidence))
        return evidence

    except Exception as e:
        logger.error("Evidence generation failed for '%s': %s", project_title, e)
        return _template_evidence(
            project_title, theme, ward_name, submission_count,
            urgency_level, ward_data, rag_context,
        )


# ─── Batch evidence generation ────────────────────────────────────────────────

async def generate_evidence_batch(projects: list[dict], ward_lookup: dict) -> list[dict]:
    """
    Generate evidence for a list of project dicts in sequence.
    Updates each dict in-place with an "evidence_text" key.

    Args:
        projects:    List of project dicts (same shape as Project ORM model)
        ward_lookup: Dict mapping ward_id → ward data dict

    Returns:
        The same list with evidence_text populated.
    """
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
        f"Theme: {theme}",
        f"Ward: {ward_name}",
        f"Priority rank: #{priority_rank}",
        f"Citizen submissions: {submission_count}",
        f"Urgency level: {urgency_level} (score: {urgency_score:.2f})",
        f"Demand score: {demand_score:.2f}  |  Gap score: {gap_score:.2f}",
    ]

    if ward_data:
        pop = ward_data.get("population", 0)
        school_km   = ward_data.get("nearest_school_km", 0)
        hospital_km = ward_data.get("nearest_hospital_km", 0)
        school_age  = ward_data.get("school_age_population", 0)
        lines.append(f"Ward population: {pop:,}")
        if school_age:
            lines.append(f"School-age children: {school_age:,}")
        if school_km:
            lines.append(f"Nearest school: {school_km} km")
        if hospital_km:
            lines.append(f"Nearest hospital: {hospital_km} km")

    if sample_submissions:
        lines.append("\nSample citizen submissions:")
        for i, s in enumerate(sample_submissions[:3], 1):
            lines.append(f'  {i}. "{s[:200]}"')

    if rag_context:
        lines.append("\nRelevant development plan excerpts:")
        for ctx in rag_context[:3]:
            chunk = ctx.get("chunk", "")[:300]
            title = ctx.get("metadata", {}).get("title", "Development Plan")
            lines.append(f'  [{title}] "{chunk}"')

    return "\n".join(lines)


def _template_evidence(
    project_title: str,
    theme: str,
    ward_name: str,
    submission_count: int,
    urgency_level: str,
    ward_data: Optional[dict],
    rag_context: Optional[list[dict]],
) -> str:
    """Template-based fallback — no API key required."""
    theme_labels = {
        "schools":     "school infrastructure",
        "roads":       "road conditions",
        "water":       "water supply",
        "health":      "healthcare access",
        "electricity": "electricity supply",
        "other":       "development needs",
    }
    label = theme_labels.get(theme, theme)

    parts = [
        f"{submission_count} citizen submission{'s' if submission_count != 1 else ''} "
        f"from {ward_name} identified {label} as a {urgency_level}-urgency need."
    ]

    if ward_data:
        if theme == "schools":
            km = ward_data.get("nearest_school_km")
            pop = ward_data.get("school_age_population")
            if km and km > 2:
                parts.append(
                    f"The nearest school is {km} km away, creating a significant access gap "
                    f"for the ward's {pop:,} school-age children."
                    if pop else
                    f"The nearest school is {km} km away, well above the recommended 2 km safe-walk threshold."
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
