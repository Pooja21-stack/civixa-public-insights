from sqlalchemy import String, Text, JSON, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin
import enum


class DocumentType(str, enum.Enum):
    dev_plan = "dev_plan"
    census = "census"
    school_data = "school_data"
    health_data = "health_data"
    other = "other"


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    doc_type: Mapped[DocumentType] = mapped_column(SAEnum(DocumentType), default=DocumentType.other)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=True)
    content_text: Mapped[str] = mapped_column(Text, nullable=True)
    ward_id: Mapped[str] = mapped_column(String(36), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    is_indexed: Mapped[bool] = mapped_column(default=False)
