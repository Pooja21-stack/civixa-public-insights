from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models.project import ProjectSource


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: Optional[str]
    theme: str
    ward_id: Optional[str]
    ward_name: Optional[str]
    demand_score: float
    gap_score: float
    feasibility_score: float
    urgency_score: float
    priority_score: float
    priority_rank: int
    evidence_text: Optional[str]
    submission_count: int
    affected_population: int
    source: ProjectSource
    created_at: datetime


class PriorityListResponse(BaseModel):
    items: List[ProjectResponse]
    total: int
