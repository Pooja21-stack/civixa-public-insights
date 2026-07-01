"""
Submission service — orchestrates the full ingestion pipeline.

create_submission():
  1. Persist raw submission to DB
  2. Fire Celery task for async AI processing
  3. Return the raw submission immediately (AI enrichment happens in background)

get_submissions():
  Paginated list with optional theme / ward filters.

get_hotspots():
  Returns a GeoJSON FeatureCollection of all geo-tagged submissions
  for the Mapbox heatmap.

rerank_ward():
  Recompute priority scores for all (theme, ward) pairs in a given ward.
  Called by the Celery worker after each new submission is processed.
"""
from __future__ import annotations
import logging
import uuid
from typing import Optional

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.submission import Submission, Channel, UrgencyLevel
from app.models.project import Project, ProjectSource
from app.models.ward import Ward
from app.schemas.submission import SubmissionResponse
from app.services.ai.scorer import (
    compute_demand_score,
    compute_gap_score,
    compute_feasibility_score,
    compute_priority_score,
)

logger = logging.getLogger(__name__)


# ─── Create submission ────────────────────────────────────────────────────────

async def create_submission(
    db: AsyncSession,
    text_raw: str,
    channel: str = "web",
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    ward_id: Optional[str] = None,
    lang: Optional[str] = None,
    media_urls: Optional[list] = None,
    submitter_phone: Optional[str] = None,
) -> Submission:
    """Persist the submission and return it. AI processing is async via Celery."""
    submission = Submission(
        id=str(uuid.uuid4()),
        channel=Channel(channel) if channel in Channel.__members__ else Channel.web,
        text_raw=text_raw,
        text_translated=None,
        lang_detected=lang or "en",
        lat=lat,
        lng=lng,
        ward_id=ward_id,
        themes=[],
        urgency_score=0.5,
        urgency_level=UrgencyLevel.medium,
        ai_analysis={},
        media_urls=media_urls or [],
        submitter_phone=submitter_phone,
    )
    db.add(submission)
    await db.flush()  # get the ID without committing

    logger.info("Created submission %s (channel=%s, ward=%s)", submission.id, channel, ward_id)
    return submission


# ─── Enrich submission (called by Celery worker) ──────────────────────────────

async def enrich_submission(
    db: AsyncSession,
    submission_id: str,
    lang_detected: str,
    text_translated: str,
    themes: list,
    urgency_score: float,
    urgency_level: str,
    summary: str,
) -> None:
    """Update a submission with AI analysis results."""
    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    submission = result.scalar_one_or_none()
    if not submission:
        logger.warning("enrich_submission: submission %s not found", submission_id)
        return

    submission.lang_detected   = lang_detected
    submission.text_translated = text_translated
    submission.themes          = themes
    submission.urgency_score   = urgency_score
    submission.urgency_level   = UrgencyLevel(urgency_level) if urgency_level in UrgencyLevel.__members__ else UrgencyLevel.medium
    submission.ai_analysis     = {"summary": summary}

    logger.info("Enriched submission %s → themes=%s urgency=%s", submission_id, themes, urgency_level)


# ─── List submissions ─────────────────────────────────────────────────────────

async def list_submissions(
    db: AsyncSession,
    page: int = 1,
    per_page: int = 20,
    theme: Optional[str] = None,
    ward_id: Optional[str] = None,
) -> dict:
    query = select(Submission).order_by(Submission.created_at.desc())

    if theme:
        # JSON array contains check — works with PostgreSQL jsonb
        query = query.where(Submission.themes.contains([theme]))
    if ward_id:
        query = query.where(Submission.ward_id == ward_id)

    # Total count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(query)).scalars().all()

    return {"items": list(rows), "total": total, "page": page, "per_page": per_page}


# ─── Hotspots GeoJSON ─────────────────────────────────────────────────────────

async def get_hotspots(db: AsyncSession) -> dict:
    """Return a GeoJSON FeatureCollection for Mapbox heatmap rendering."""
    result = await db.execute(
        select(Submission).where(
            Submission.lat.isnot(None),
            Submission.lng.isnot(None),
        )
    )
    submissions = result.scalars().all()

    features = []
    for s in submissions:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [s.lng, s.lat],
            },
            "properties": {
                "id":            s.id,
                "urgency_score": s.urgency_score,
                "theme":         s.themes[0] if s.themes else "other",
                "ward_id":       s.ward_id,
            },
        })

    return {"type": "FeatureCollection", "features": features}


# ─── Re-rank projects for a ward ─────────────────────────────────────────────

async def rerank_ward_projects(db: AsyncSession, ward_id: str) -> None:
    """
    Recompute priority scores for every (theme) in this ward based on
    current submission counts and ward demographics.
    Called after a new submission is AI-enriched.
    """
    # Get ward demographics
    ward_result = await db.execute(select(Ward).where(Ward.id == ward_id))
    ward = ward_result.scalar_one_or_none()
    if not ward:
        logger.warning("rerank_ward_projects: ward %s not found", ward_id)
        return

    ward_data = {
        "population":            ward.population,
        "school_age_population": ward.school_age_population,
        "nearest_school_km":     ward.nearest_school_km,
        "nearest_hospital_km":   ward.nearest_hospital_km,
    }

    # Aggregate: count submissions and avg urgency per theme in this ward
    agg_result = await db.execute(
        text("""
            SELECT
                jsonb_array_elements_text(themes::jsonb) AS theme,
                COUNT(*)                                 AS cnt,
                AVG(urgency_score)                       AS avg_urgency
            FROM submissions
            WHERE ward_id = :ward_id
              AND themes IS NOT NULL
              AND themes != '[]'::jsonb
            GROUP BY theme
        """),
        {"ward_id": ward_id},
    )
    rows = agg_result.fetchall()
    if not rows:
        return

    # Find global max count (across all wards) for demand normalisation
    max_result = await db.execute(
        text("""
            SELECT MAX(cnt) FROM (
                SELECT COUNT(*) AS cnt
                FROM submissions
                WHERE themes IS NOT NULL
                GROUP BY ward_id, jsonb_array_elements_text(themes::jsonb)
            ) sub
        """)
    )
    max_count = max_result.scalar_one() or 1

    for row in rows:
        theme, cnt, avg_urgency = row.theme, int(row.cnt), float(row.avg_urgency or 0.5)

        demand      = compute_demand_score(cnt, max_count)
        gap         = compute_gap_score(theme, ward_data)
        feasibility = compute_feasibility_score(
            in_dev_plan=False,          # RAG pipeline will update this later
            ward_has_boundary=ward.boundary_geojson is not None,
        )
        priority    = compute_priority_score(demand, gap, feasibility, avg_urgency)

        # Upsert the project
        proj_result = await db.execute(
            select(Project).where(
                Project.ward_id == ward_id,
                Project.theme   == theme,
                Project.source  == ProjectSource.citizen,
            )
        )
        project = proj_result.scalar_one_or_none()

        if project:
            project.demand_score      = demand
            project.gap_score         = gap
            project.feasibility_score = feasibility
            project.urgency_score     = avg_urgency
            project.priority_score    = priority
            project.submission_count  = cnt
        else:
            project = Project(
                id                = str(uuid.uuid4()),
                title             = f"{theme.title()} improvement — {ward.name}",
                theme             = theme,
                ward_id           = ward_id,
                demand_score      = demand,
                gap_score         = gap,
                feasibility_score = feasibility,
                urgency_score     = avg_urgency,
                priority_score    = priority,
                submission_count  = cnt,
                source            = ProjectSource.citizen,
            )
            db.add(project)

    # Re-assign global ranks across ALL projects
    all_projects_result = await db.execute(
        select(Project).order_by(Project.priority_score.desc())
    )
    all_projects = all_projects_result.scalars().all()
    for rank, p in enumerate(all_projects, start=1):
        p.priority_rank = rank

    logger.info("Re-ranked %d projects after ward %s update", len(all_projects), ward_id)
