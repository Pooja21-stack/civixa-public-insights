from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.project import PriorityListResponse, ProjectResponse

router = APIRouter()


@router.get("/priority", response_model=PriorityListResponse)
async def get_priority_projects(db: AsyncSession = Depends(get_db)):
    raise HTTPException(status_code=501, detail="Priority scoring not yet implemented")


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    raise HTTPException(status_code=404, detail="Project not found")
