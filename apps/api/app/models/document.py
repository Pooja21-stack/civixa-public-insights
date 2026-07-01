from sqlalchemy import String, Text, Integer, JSON, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from app.models.base import Base, TimestampMixin
import enum


class DocumentType(str, enum.Enum):
    dev_plan = "dev_plan"
    development_plan = "development_plan"
    census = "census"
    school_data = "school_data"
    health_data = "health_data"
    other = "other"


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(50), default="other")
    file_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    content_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ward_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    is_indexed: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
