from sqlalchemy import String, Float, Integer, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin
import enum


class ProjectSource(str, enum.Enum):
    citizen = "citizen"
    dev_plan = "dev_plan"
    combined = "combined"


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    theme: Mapped[str] = mapped_column(String(100), nullable=False)
    ward_id: Mapped[str] = mapped_column(String(36), ForeignKey("wards.id"), nullable=True)
    demand_score: Mapped[float] = mapped_column(Float, default=0.0)
    gap_score: Mapped[float] = mapped_column(Float, default=0.0)
    feasibility_score: Mapped[float] = mapped_column(Float, default=0.5)
    urgency_score: Mapped[float] = mapped_column(Float, default=0.5)
    priority_score: Mapped[float] = mapped_column(Float, default=0.0)
    priority_rank: Mapped[int] = mapped_column(Integer, default=0)
    evidence_text: Mapped[str] = mapped_column(Text, nullable=True)
    submission_count: Mapped[int] = mapped_column(Integer, default=0)
    affected_population: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[ProjectSource] = mapped_column(SAEnum(ProjectSource), default=ProjectSource.citizen)

    ward = relationship("Ward", back_populates="projects", foreign_keys=[ward_id])
