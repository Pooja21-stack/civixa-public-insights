from sqlalchemy import String, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class Ward(Base, TimestampMixin):
    __tablename__ = "wards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    constituency: Mapped[str] = mapped_column(String(200), nullable=False)
    population: Mapped[int] = mapped_column(Integer, default=0)
    school_age_population: Mapped[int] = mapped_column(Integer, default=0)
    nearest_school_km: Mapped[float] = mapped_column(default=0.0)
    nearest_hospital_km: Mapped[float] = mapped_column(default=0.0)
    boundary_geojson: Mapped[dict] = mapped_column(JSON, nullable=True)
    demographics: Mapped[dict] = mapped_column(JSON, default=dict)

    submissions = relationship(
        "Submission",
        back_populates="ward",
        primaryjoin="Ward.id == Submission.ward_id",
        foreign_keys="[Submission.ward_id]",
    )
    projects = relationship(
        "Project",
        back_populates="ward",
        primaryjoin="Ward.id == Project.ward_id",
        foreign_keys="[Project.ward_id]",
    )
