from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth_deps import require_role
from app.core.database import get_db
from app.models.project import Project
from app.models.user import User
from app.models.ward import Ward
from app.schemas.project import PriorityListResponse, ProjectResponse

router = APIRouter()


def _to_response(project: Project) -> dict:
    """Convert a Project ORM object to a dict, enriching ward_name from the joined ward."""
    d = {
        "id":                 project.id,
        "title":              project.title,
        "description":        project.description,
        "theme":              project.theme,
        "ward_id":            project.ward_id,
        "ward_name":          project.ward.name if project.ward else None,
        "demand_score":       project.demand_score,
        "gap_score":          project.gap_score,
        "feasibility_score":  project.feasibility_score,
        "urgency_score":      project.urgency_score,
        "priority_score":     project.priority_score,
        "priority_rank":      project.priority_rank,
        "evidence_text":      project.evidence_text,
        "submission_count":   project.submission_count,
        "affected_population": project.affected_population,
        "source":             project.source,
        "created_at":         project.created_at,
    }
    return d


@router.get("/priority", response_model=PriorityListResponse)
async def get_priority_projects(
    db:    AsyncSession = Depends(get_db),
    _user: User         = Depends(require_role("staff", "mp", "admin")),
):
    """Return all projects sorted by priority rank. Requires staff / mp / admin."""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.ward))
        .order_by(Project.priority_rank.asc())
    )
    projects = result.scalars().all()
    items = [ProjectResponse(**_to_response(p)) for p in projects]
    return PriorityListResponse(items=items, total=len(items))


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db:    AsyncSession = Depends(get_db),
    _user: User         = Depends(require_role("staff", "mp", "admin")),
):
    """Return a single project by ID. Requires staff / mp / admin."""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.ward))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(**_to_response(project))
