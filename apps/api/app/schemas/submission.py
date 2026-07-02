from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict, model_validator
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
    text_translated: Optional[str] = None
    lang_detected: str = "en"
    lang: Optional[str] = None          # alias for lang_detected — populated by validator
    lat: Optional[float] = None
    lng: Optional[float] = None
    ward_id: Optional[str] = None
    ward_name: Optional[str] = None     # resolved from the ward relationship
    themes: List[str] = []
    urgency_score: float = 0.5
    urgency_level: UrgencyLevel = UrgencyLevel.medium
    created_at: datetime

    @model_validator(mode="after")
    def _resolve_computed_fields(self) -> "SubmissionResponse":
        """
        Runs after every construction path (ORM, dict, another model instance).
        - lang       → mirror of lang_detected so the frontend has one field to check
        - ward_name  → resolved from the ORM relationship if not already set
        """
        # Always keep lang in sync with lang_detected
        if not self.lang:
            self.lang = self.lang_detected
        return self

    @classmethod
    def from_orm_with_ward(cls, submission: object) -> "SubmissionResponse":
        """Build the response, resolving ward_name from the loaded ORM relationship."""
        obj = cls.model_validate(submission)
        if obj.ward_name is None:
            ward = getattr(submission, "ward", None)
            if ward is not None:
                obj.ward_name = getattr(ward, "name", None)
        return obj


class SubmissionListResponse(BaseModel):
    items: List[SubmissionResponse]
    total: int
    page: int
    per_page: int
