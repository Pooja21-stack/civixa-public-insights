from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


class WardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    constituency: str
    population: int = 0
    school_age_population: int = 0
    nearest_school_km: float = 0.0
    nearest_hospital_km: float = 0.0
    created_at: datetime

    # Aggregated fields — populated by the router, not the ORM
    submission_count: int = 0
    top_theme: Optional[str] = None
    project_count: int = 0


class WardListResponse(BaseModel):
    items: List[WardResponse]
    total: int
