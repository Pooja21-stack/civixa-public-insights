"""Initial schema — all tables

Revision ID: 0001
Revises: 
Create Date: 2024-06-14 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension (no-op if already exists)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── wards ──────────────────────────────────────────────────────────────────
    op.create_table(
        "wards",
        sa.Column("id",                    sa.String(36),  primary_key=True),
        sa.Column("name",                  sa.String(200), nullable=False),
        sa.Column("constituency",          sa.String(200), nullable=False),
        sa.Column("population",            sa.Integer,     default=0),
        sa.Column("school_age_population", sa.Integer,     default=0),
        sa.Column("nearest_school_km",     sa.Float,       default=0.0),
        sa.Column("nearest_hospital_km",   sa.Float,       default=0.0),
        sa.Column("boundary_geojson",      sa.JSON,        nullable=True),
        sa.Column("demographics",          sa.JSON,        default=dict),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id",              sa.String(36),  primary_key=True),
        sa.Column("email",           sa.String(255), unique=True, nullable=False),
        sa.Column("name",            sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role",            sa.String(20),  default="staff"),
        sa.Column("constituency",    sa.String(200), nullable=True),
        sa.Column("is_active",       sa.Boolean,     default=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── submissions ────────────────────────────────────────────────────────────
    op.create_table(
        "submissions",
        sa.Column("id",              sa.String(36),  primary_key=True),
        sa.Column("channel",         sa.String(20),  default="web"),
        sa.Column("text_raw",        sa.Text,        nullable=False),
        sa.Column("text_translated", sa.Text,        nullable=True),
        sa.Column("lang_detected",   sa.String(10),  default="en"),
        sa.Column("lat",             sa.Float,       nullable=True),
        sa.Column("lng",             sa.Float,       nullable=True),
        sa.Column("ward_id",         sa.String(36),  sa.ForeignKey("wards.id"), nullable=True),
        sa.Column("themes",          sa.JSON,        default=list),
        sa.Column("urgency_score",   sa.Float,       default=0.5),
        sa.Column("urgency_level",   sa.String(20),  default="medium"),
        sa.Column("ai_analysis",     sa.JSON,        default=dict),
        sa.Column("media_urls",      sa.JSON,        default=list),
        sa.Column("submitter_phone", sa.String(20),  nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_submissions_ward_id",   "submissions", ["ward_id"])
    op.create_index("ix_submissions_created_at","submissions", ["created_at"])

    # ── projects ───────────────────────────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id",                 sa.String(36),  primary_key=True),
        sa.Column("title",              sa.String(500), nullable=False),
        sa.Column("description",        sa.Text,        nullable=True),
        sa.Column("theme",              sa.String(100), nullable=False),
        sa.Column("ward_id",            sa.String(36),  sa.ForeignKey("wards.id"), nullable=True),
        sa.Column("demand_score",       sa.Float,       default=0.0),
        sa.Column("gap_score",          sa.Float,       default=0.0),
        sa.Column("feasibility_score",  sa.Float,       default=0.5),
        sa.Column("urgency_score",      sa.Float,       default=0.5),
        sa.Column("priority_score",     sa.Float,       default=0.0),
        sa.Column("priority_rank",      sa.Integer,     default=0),
        sa.Column("evidence_text",      sa.Text,        nullable=True),
        sa.Column("submission_count",   sa.Integer,     default=0),
        sa.Column("affected_population",sa.Integer,     default=0),
        sa.Column("source",             sa.String(20),  default="citizen"),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_projects_priority_rank", "projects", ["priority_rank"])
    op.create_index("ix_projects_ward_theme",    "projects", ["ward_id", "theme"])

    # ── documents ──────────────────────────────────────────────────────────────
    op.create_table(
        "documents",
        sa.Column("id",            sa.String(36),   primary_key=True),
        sa.Column("title",         sa.String(500),  nullable=False),
        sa.Column("doc_type",      sa.String(50),   default="other"),
        sa.Column("file_url",      sa.String(1000), nullable=True),
        sa.Column("content_text",  sa.Text,         nullable=True),
        sa.Column("ward_id",       sa.String(36),   nullable=True),
        sa.Column("metadata_json", sa.JSON,         default=dict),
        sa.Column("is_indexed",    sa.Boolean,      default=False),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("documents")
    op.drop_index("ix_projects_ward_theme",    table_name="projects")
    op.drop_index("ix_projects_priority_rank", table_name="projects")
    op.drop_table("projects")
    op.drop_index("ix_submissions_created_at", table_name="submissions")
    op.drop_index("ix_submissions_ward_id",    table_name="submissions")
    op.drop_table("submissions")
    op.drop_table("users")
    op.drop_table("wards")
