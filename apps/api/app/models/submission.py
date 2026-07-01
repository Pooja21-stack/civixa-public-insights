from sqlalchemy import String, Float, Integer, JSON, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin
import enum


class Channel(str, enum.Enum):
    web = "web"
    whatsapp = "whatsapp"
    voice = "voice"


class UrgencyLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Submission(Base, TimestampMixin):
    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    channel: Mapped[Channel] = mapped_column(SAEnum(Channel), default=Channel.web)
    text_raw: Mapped[str] = mapped_column(Text, nullable=False)
    text_translated: Mapped[str] = mapped_column(Text, nullable=True)
    lang_detected: Mapped[str] = mapped_column(String(10), default="en")
    lat: Mapped[float] = mapped_column(Float, nullable=True)
    lng: Mapped[float] = mapped_column(Float, nullable=True)
    ward_id: Mapped[str] = mapped_column(String(36), nullable=True)
    themes: Mapped[list] = mapped_column(JSON, default=list)
    urgency_score: Mapped[float] = mapped_column(Float, default=0.5)
    urgency_level: Mapped[UrgencyLevel] = mapped_column(
        SAEnum(UrgencyLevel), default=UrgencyLevel.medium
    )
    ai_analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    media_urls: Mapped[list] = mapped_column(JSON, default=list)
    submitter_phone: Mapped[str] = mapped_column(String(20), nullable=True)

    ward = relationship(
        "Ward",
        back_populates="submissions",
        primaryjoin="Submission.ward_id == Ward.id",
        foreign_keys="[Submission.ward_id]",
    )
