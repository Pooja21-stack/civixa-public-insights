"""
Document ingestion router — accepts PDF/CSV development plans, stores them,
and fires the RAG ingestion Celery pipeline.

Endpoints:
  POST /api/v1/documents/upload       — upload a PDF/CSV dev plan
  GET  /api/v1/documents/             — list ingested documents
  POST /api/v1/documents/{id}/query   — semantic search / RAG query against docs
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Optional

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = "uploads/documents"
ALLOWED_TYPES = {"application/pdf", "text/csv", "text/plain"}
MAX_FILE_MB = 50


class DocumentMeta(BaseModel):
    id: str
    filename: str
    title: str
    doc_type: str
    file_size_kb: int
    status: str


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5


class QueryResponse(BaseModel):
    question: str
    answer: str
    sources: list


@router.post("/upload", response_model=DocumentMeta, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    doc_type: str = Form("development_plan"),
    ward_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("mp", "staff", "admin")),
):
    """
    Upload a PDF or CSV development plan.
    Saves the file to disk and fires the RAG ingestion pipeline.
    Protected — requires mp / staff / admin role.
    """
    # Validate file type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES and not file.filename.endswith((".pdf", ".csv", ".txt")):
        raise HTTPException(400, detail=f"Unsupported file type: {content_type}")

    # Read file bytes
    file_bytes = await file.read()
    size_kb = len(file_bytes) // 1024

    if size_kb > MAX_FILE_MB * 1024:
        raise HTTPException(413, detail=f"File exceeds {MAX_FILE_MB} MB limit")

    # Save to disk
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    doc_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "doc.pdf")[1] or ".pdf"
    saved_path = os.path.join(UPLOAD_DIR, f"{doc_id}{ext}")

    async with aiofiles.open(saved_path, "wb") as f:
        await f.write(file_bytes)

    logger.info(
        "Document uploaded: id=%s title=%s size=%dKB path=%s",
        doc_id, title, size_kb, saved_path,
    )

    # Persist metadata to DB (uses Document model if available, else skip DB for now)
    try:
        from app.models.document import Document
        doc = Document(
            id=doc_id,
            title=title,
            doc_type=doc_type,
            file_path=saved_path,
            ward_id=ward_id,
            status="pending",
        )
        db.add(doc)
        await db.commit()
    except Exception as e:
        logger.warning("Document model not available — skipping DB persist: %s", e)

    # Queue RAG ingestion task
    try:
        from app.workers.tasks import ingest_document
        ingest_document.delay(doc_id, saved_path, doc_type)
    except Exception as e:
        logger.warning("Could not queue ingest_document task: %s", e)

    return DocumentMeta(
        id=doc_id,
        filename=file.filename or "document",
        title=title,
        doc_type=doc_type,
        file_size_kb=size_kb,
        status="queued",
    )


@router.get("/")
async def list_documents(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """List ingested documents — reads from the uploads directory."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    files = sorted(os.listdir(UPLOAD_DIR))

    docs = []
    for fname in files:
        path = os.path.join(UPLOAD_DIR, fname)
        stat = os.stat(path)
        docs.append({
            "id": os.path.splitext(fname)[0],
            "filename": fname,
            "size_kb": stat.st_size // 1024,
        })

    start = (page - 1) * per_page
    return {
        "items": docs[start: start + per_page],
        "total": len(docs),
        "page": page,
        "per_page": per_page,
    }


@router.post("/{doc_id}/query", response_model=QueryResponse)
async def query_document(
    doc_id: str,
    payload: QueryRequest,
    current_user: User = Depends(get_current_user),
):
    """
    RAG semantic search against ingested documents.
    Returns a generated answer with source excerpts.
    """
    try:
        from app.services.ai.rag_pipeline import query_documents
        from app.services.ai.evidence_generator import generate_evidence

        results = query_documents(payload.question, top_k=payload.top_k)

        if not results:
            return QueryResponse(
                question=payload.question,
                answer="No relevant content found in the ingested documents.",
                sources=[],
            )

        # Build context from top results
        context = "\n\n".join(r["text"] for r in results)
        evidence = await generate_evidence(
            theme="document_query",
            ward_name="constituency",
            submission_count=0,
            avg_urgency=0.5,
            context_docs=context,
        )

        return QueryResponse(
            question=payload.question,
            answer=evidence.get("evidence_summary", context[:500]),
            sources=[{"text": r["text"][:200], "score": r.get("score", 0)} for r in results],
        )
    except Exception as e:
        logger.error("RAG query failed: %s", e)
        raise HTTPException(500, detail=f"Query failed: {str(e)}")
