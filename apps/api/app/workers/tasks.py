"""
Celery worker tasks for async AI processing.

process_submission pipeline:
  1. Load submission from DB
  2. Transcribe audio (if voice channel)
  3. Detect language + translate to English
  4. Call GPT-4o for theme extraction + urgency scoring
  5. Update submission record with enriched data
  6. Re-rank priority projects for the affected ward

ingest_document pipeline (stub — wired in RAG step):
  1. Extract text from PDF/CSV
  2. Chunk into segments
  3. Embed with sentence-transformers
  4. Store vectors in pgvector
"""
from __future__ import annotations
import asyncio
import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run a coroutine from within a synchronous Celery task."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


@celery_app.task(name="app.workers.tasks.process_submission", bind=True, max_retries=3)
def process_submission(self, submission_id: str):
    """
    Full AI enrichment pipeline for a single submission.
    Retries up to 3 times with exponential back-off on transient failures.
    """
    try:
        _run_async(_process_submission_async(submission_id))
    except Exception as exc:
        logger.error("process_submission failed for %s: %s", submission_id, exc)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


async def _process_submission_async(submission_id: str) -> None:
    """Async implementation — runs inside the sync Celery task via _run_async."""
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.submission import Submission
    from app.services.ai.transcriber import transcribe_audio
    from app.services.ai.translator  import detect_and_translate
    from app.services.ai.theme_extractor import extract_themes
    from app.services import submission_service

    async with AsyncSessionLocal() as db:
        # 1. Load submission
        result = await db.execute(select(Submission).where(Submission.id == submission_id))
        submission = result.scalar_one_or_none()
        if not submission:
            logger.warning("Submission %s not found — skipping AI processing", submission_id)
            return

        text_to_process = submission.text_raw

        # 2. Transcribe audio if voice channel and we have a media file
        if submission.channel.value == "voice" and submission.media_urls:
            try:
                import aiofiles
                audio_path = submission.media_urls[0]
                async with aiofiles.open(audio_path, "rb") as f:
                    audio_bytes = await f.read()
                transcription = await transcribe_audio(
                    audio_bytes, audio_path.split("/")[-1]
                )
                if transcription["text"]:
                    text_to_process = transcription["text"]
                    submission.lang_detected = transcription["lang"]
                    logger.info("Transcribed voice → %d chars, lang=%s",
                                len(text_to_process), transcription["lang"])
            except Exception as e:
                logger.warning("Voice transcription skipped: %s", e)

        # 3. Detect language + translate to English
        translation = detect_and_translate(text_to_process)
        lang_detected   = translation["lang_detected"]
        text_translated = translation["text_translated"]

        # 4. Extract themes + urgency via GPT-4o
        analysis = await extract_themes(text_translated)

        # 5. Enrich submission in DB
        await submission_service.enrich_submission(
            db              = db,
            submission_id   = submission_id,
            lang_detected   = lang_detected,
            text_translated = text_translated,
            themes          = analysis["themes"],
            urgency_score   = analysis["urgency_score"],
            urgency_level   = analysis["urgency_level"],
            summary         = analysis["summary"],
        )

        # 6. Re-rank projects for the affected ward
        if submission.ward_id:
            await submission_service.rerank_ward_projects(db, submission.ward_id)

        # 7. Re-cluster all submissions in this ward (async — non-blocking for DB commit)
        if submission.ward_id:
            try:
                from sqlalchemy import select as sa_select
                from app.models.submission import Submission as Sub
                from app.services.ai.clustering import cluster_ward_submissions

                all_subs_result = await db.execute(
                    sa_select(Sub).where(Sub.ward_id == submission.ward_id)
                )
                all_subs = all_subs_result.scalars().all()
                subs_data = [
                    {
                        "id":               s.id,
                        "text_raw":         s.text_raw,
                        "text_translated":  s.text_translated,
                        "themes":           s.themes,
                        "urgency_score":    s.urgency_score,
                    }
                    for s in all_subs
                ]
                cluster_result = cluster_ward_submissions(submission.ward_id, subs_data)
                logger.info(
                    "Clustered ward %s → %d clusters (top: %s, size: %d)",
                    submission.ward_id,
                    len(cluster_result["clusters"]),
                    cluster_result["top_theme"],
                    cluster_result["top_cluster_size"],
                )
            except Exception as e:
                logger.warning("Ward clustering failed (non-fatal): %s", e)

        await db.commit()
        logger.info(
            "Processed submission %s → themes=%s urgency=%s",
            submission_id, analysis["themes"], analysis["urgency_level"]
        )


@celery_app.task(name="app.workers.tasks.ingest_document", bind=True, max_retries=3)
def ingest_document(self, document_id: str, file_path: str = "", doc_type: str = "development_plan"):
    """
    Full RAG ingestion pipeline.
    1. Read file bytes from disk
    2. Extract text (PDF via PyMuPDF, CSV/TXT plain)
    3. Chunk into ~500-token segments
    4. Embed with sentence-transformers
    5. Store chunks in in-memory vector store (pgvector in production)
    6. Update document status in DB
    """
    try:
        _run_async(_ingest_document_async(document_id, file_path, doc_type))
    except Exception as exc:
        logger.error("ingest_document failed for %s: %s", document_id, exc)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


async def _ingest_document_async(document_id: str, file_path: str, doc_type: str) -> None:
    """Async implementation of the document ingestion pipeline."""
    import os

    if not file_path or not os.path.exists(file_path):
        logger.warning("ingest_document: file not found at %s", file_path)
        return

    # 1. Read file
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    # 2. Extract text
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        from app.services.ingestion.pdf_loader import extract_text_from_pdf
        text = extract_text_from_pdf(file_bytes)
    else:
        # CSV / TXT
        text = file_bytes.decode("utf-8", errors="replace")

    if not text.strip():
        logger.warning("ingest_document: empty text extracted from %s", file_path)
        return

    logger.info("ingest_document: extracted %d chars from %s", len(text), file_path)

    # 3+4+5. Chunk, embed, store in RAG vector store
    from app.services.ai.rag_pipeline import ingest_document as rag_ingest
    result = await rag_ingest(
        document_id=document_id,
        title=os.path.basename(file_path),
        text=text,
        doc_type=doc_type,
    )
    num_chunks = result.get("chunks_stored", 0)

    logger.info("ingest_document: ingested %d chunks for document %s", num_chunks, document_id)

    # 6. Update document status in DB (if Document model exists)
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.document import Document
        from sqlalchemy import select as sa_select

        async with AsyncSessionLocal() as db:
            res = await db.execute(sa_select(Document).where(Document.id == document_id))
            doc = res.scalar_one_or_none()
            if doc:
                doc.status = "indexed"
                doc.chunk_count = num_chunks
                doc.is_indexed = True
                await db.commit()
    except Exception as e:
        logger.warning("Could not update document status in DB: %s", e)
