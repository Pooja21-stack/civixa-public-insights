from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.project import Project
from app.schemas.project import PriorityListResponse, ProjectResponse

router = APIRouter()


@router.get("/priority", response_model=PriorityListResponse)
async def get_priority_projects(db: AsyncSession = Depends(get_db)):
    """Return all projects sorted by priority rank ascending (rank 1 = highest priority)."""
    result = await db.execute(
        select(Project).order_by(Project.priority_rank.asc())
    )
    projects = result.scalars().all()
    return PriorityListResponse(items=list(projects), total=len(projects))


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Return a single project by ID."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
