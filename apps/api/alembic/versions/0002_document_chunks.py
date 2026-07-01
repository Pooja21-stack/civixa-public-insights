"""Add document_chunks table for pgvector RAG storage

Revision ID: 0002
Revises: 0001
Create Date: 2024-06-15 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_chunks",
        sa.Column("id",          sa.String(36),   primary_key=True),
        sa.Column("document_id", sa.String(36),   sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title",       sa.String(500),  nullable=False),
        sa.Column("doc_type",    sa.String(50),   default="other"),
        sa.Column("ward_id",     sa.String(36),   nullable=True),
        sa.Column("chunk_text",  sa.Text,         nullable=False),
        sa.Column("chunk_index", sa.Integer,      default=0),
        # embedding stored as JSON array for SQLite compat; pgvector VECTOR type used in PostgreSQL
        sa.Column("embedding",   sa.JSON,         nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Indexes for fast retrieval
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index("ix_document_chunks_ward_id",     "document_chunks", ["ward_id"])
    op.create_index("ix_document_chunks_doc_type",    "document_chunks", ["doc_type"])


def downgrade() -> None:
    op.drop_index("ix_document_chunks_doc_type",    "document_chunks")
    op.drop_index("ix_document_chunks_ward_id",     "document_chunks")
    op.drop_index("ix_document_chunks_document_id", "document_chunks")
    op.drop_table("document_chunks")
