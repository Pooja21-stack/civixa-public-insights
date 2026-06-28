from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models.submission import Channel, UrgencyLevel


class SubmissionCreate(BaseModel):
    text_raw: str = Field(..., min_length=5, max_length=5000)
    channel: Channel = Channel.web
    lat: Optional[float] = None
    lng: Optional[float] = None
    ward_id: Optional[str] = None
    lang: Optional[str] = None


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    channel: Channel
    text_raw: str
    text_translated: Optional[str]
    lang_detected: str
    lat: Optional[float]
    lng: Optional[float]
    ward_id: Optional[str]
    themes: List[str]
    urgency_score: float
    urgency_level: UrgencyLevel
    created_at: datetime


class SubmissionListResponse(BaseModel):
    items: List[SubmissionResponse]
    total: int
    page: int
    per_page: int
