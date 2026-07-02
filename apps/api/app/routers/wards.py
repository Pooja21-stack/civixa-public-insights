"""
Wards router — constituency ward management.

Endpoints:
  GET  /api/v1/wards                  — paginated list of all wards with stats
  GET  /api/v1/wards/{ward_id}        — single ward detail + submissions + projects
  POST /api/v1/wards                  — create a ward (admin only)
  PUT  /api/v1/wards/{ward_id}        — update ward demographics (admin only)
"""
from __future__ import annotations

import uuid
from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth_deps import require_role
from app.core.database import get_db
from app.models.user import User
from app.models.ward import Ward
from app.models.submission import Submission
from app.models.project import Project
from app.schemas.ward import WardResponse, WardListResponse

router = APIRouter()


def _enrich_ward(ward: Ward, submissions: list, projects: list) -> WardResponse:
    """Add aggregated stats to a Ward ORM object."""
    # Count top theme from submissions
    all_themes = [t for s in submissions for t in (s.themes or [])]
    top_theme = Counter(all_themes).most_common(1)[0][0] if all_themes else None

    return WardResponse(
        id=ward.id,
        name=ward.name,
        constituency=ward.constituency,
        population=ward.population,
        school_age_population=ward.school_age_population,
        nearest_school_km=ward.nearest_school_km,
        nearest_hospital_km=ward.nearest_hospital_km,
        created_at=ward.created_at,
        submission_count=len(submissions),
        top_theme=top_theme,
        project_count=len(projects),
    )


@router.get("", response_model=WardListResponse)
async def list_wards(
    page:     int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db:    AsyncSession = Depends(get_db),
    _user: User         = Depends(require_role("staff", "mp", "admin")),
):
    """Return all wards with submission counts and top theme. Requires staff / mp / admin."""
    # Total count
    total = (await db.execute(select(func.count()).select_from(Ward))).scalar_one() or 0

    # Paginated wards
    result = await db.execute(
        select(Ward)
        .order_by(Ward.name.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    wards = result.scalars().all()

    items = []
    for ward in wards:
        # Submissions for this ward
        subs_result = await db.execute(
            select(Submission).where(Submission.ward_id == ward.id)
        )
        subs = subs_result.scalars().all()

        # Projects for this ward
        proj_result = await db.execute(
            select(Project).where(Project.ward_id == ward.id)
        )
        projs = proj_result.scalars().all()

        items.append(_enrich_ward(ward, subs, projs))

    return WardListResponse(items=items, total=total)


@router.get("/{ward_id}")
async def get_ward(
    ward_id: str,
    db:    AsyncSession = Depends(get_db),
    _user: User         = Depends(require_role("staff", "mp", "admin")),
):
    """Return a single ward detail. Requires staff / mp / admin."""
    result = await db.execute(select(Ward).where(Ward.id == ward_id))
    ward = result.scalar_one_or_none()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    # Submissions
    subs_result = await db.execute(
        select(Submission)
        .where(Submission.ward_id == ward_id)
        .order_by(Submission.created_at.desc())
        .limit(20)
    )
    submissions = subs_result.scalars().all()

    # Projects
    proj_result = await db.execute(
        select(Project)
        .where(Project.ward_id == ward_id)
        .order_by(Project.priority_rank.asc())
    )
    projects = proj_result.scalars().all()

    # Theme breakdown
    all_themes = [t for s in submissions for t in (s.themes or [])]
    theme_counts = Counter(all_themes)

    return {
        "ward": _enrich_ward(ward, submissions, projects),
        "theme_breakdown": [
            {"theme": t, "count": c} for t, c in theme_counts.most_common()
        ],
        "recent_submissions": [
            {
                "id":            s.id,
                "text_raw":      s.text_raw,
                "lang_detected": s.lang_detected,
                "channel":       s.channel.value,
                "themes":        s.themes,
                "urgency_level": s.urgency_level.value,
                "urgency_score": s.urgency_score,
                "created_at":    s.created_at.isoformat(),
            }
            for s in submissions
        ],
        "priority_projects": [
            {
                "id":            p.id,
                "title":         p.title,
                "theme":         p.theme,
                "priority_rank": p.priority_rank,
                "priority_score": round(p.priority_score, 3),
                "submission_count": p.submission_count,
            }
            for p in projects
        ],
    }


@router.post("", response_model=WardResponse, status_code=201,
             dependencies=[Depends(require_role("admin", "mp"))])
async def create_ward(payload: dict, db: AsyncSession = Depends(get_db)):
    """Create a new ward. Requires admin or mp role."""
    ward = Ward(
        id=str(uuid.uuid4()),
        name=payload["name"],
        constituency=payload.get("constituency", ""),
        population=payload.get("population", 0),
        school_age_population=payload.get("school_age_population", 0),
        nearest_school_km=payload.get("nearest_school_km", 0.0),
        nearest_hospital_km=payload.get("nearest_hospital_km", 0.0),
        boundary_geojson=payload.get("boundary_geojson"),
        demographics=payload.get("demographics", {}),
    )
    db.add(ward)
    await db.commit()
    await db.refresh(ward)
    return _enrich_ward(ward, [], [])


@router.put("/{ward_id}", response_model=WardResponse,
            dependencies=[Depends(require_role("admin", "mp"))])
async def update_ward(ward_id: str, payload: dict, db: AsyncSession = Depends(get_db)):
    """Update ward demographics. Requires admin or mp role."""
    result = await db.execute(select(Ward).where(Ward.id == ward_id))
    ward = result.scalar_one_or_none()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    updatable = [
        "name", "constituency", "population", "school_age_population",
        "nearest_school_km", "nearest_hospital_km", "boundary_geojson", "demographics",
    ]
    for field in updatable:
        if field in payload:
            setattr(ward, field, payload[field])

    await db.commit()
    await db.refresh(ward)

    subs_result = await db.execute(select(Submission).where(Submission.ward_id == ward_id))
    proj_result = await db.execute(select(Project).where(Project.ward_id == ward_id))
    return _enrich_ward(ward, subs_result.scalars().all(), proj_result.scalars().all())
