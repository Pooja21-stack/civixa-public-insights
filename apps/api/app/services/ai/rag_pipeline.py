"""
RAG (Retrieval-Augmented Generation) pipeline for development plan documents.

What this does
--------------
1. INGEST: Given a PDF/text document (local dev plan, census data, etc.)
   - Extract raw text  (pdf_loader.py handles PDF → text)
   - Split into overlapping chunks
   - Embed each chunk with OpenAI text-embedding-3-small
   - Store chunks + vectors in pgvector (documents_chunks table)
   - Mark the parent Document as is_indexed=True

2. QUERY: Given a plain-English question about a ward/theme
   - Embed the question
   - Cosine-similarity search in pgvector
   - Feed top-K chunks to GPT-4o as context
   - Return a structured answer used by the evidence generator

Architecture note
-----------------
We use pgvector directly (no LangChain overhead) to keep the dependency
footprint small and stay compatible with Python 3.9.  LangChain is still
listed in requirements.txt for future extension.

Fallback
--------
If OPENAI_API_KEY is not set, ingest() stores chunks as plain text and
query() returns an empty result — the evidence generator handles this
gracefully by relying on citizen data alone.
"""
from __future__ import annotations

import logging
import math
import textwrap
import uuid
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Text chunking
# ---------------------------------------------------------------------------

def chunk_text(text: str, chunk_size: int = None, overlap: int = None) -> list[str]:
    """
    Split text into overlapping word-level chunks.

    Args:
        text:       Raw document text
        chunk_size: Target words per chunk  (default: settings.CHUNK_SIZE)
        overlap:    Words of overlap        (default: settings.CHUNK_OVERLAP)

    Returns:
        List of text chunk strings.
    """
    chunk_size = chunk_size or settings.CHUNK_SIZE
    overlap    = overlap    or settings.CHUNK_OVERLAP

    words  = text.split()
    chunks = []
    start  = 0

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk.strip())
        if end == len(words):
            break
        start += chunk_size - overlap

    return chunks


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------

async def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed a list of texts using OpenAI text-embedding-3-small.

    Returns a list of float vectors, one per input text.
    Falls back to zero-vectors if no API key is set, so the pipeline
    can run in test/offline mode without crashing.
    """
    if not texts:
        return []

    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — returning zero embeddings")
        # 1536 dims for text-embedding-3-small
        return [[0.0] * 1536 for _ in texts]

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    batch_size = settings.EMBED_BATCH_SIZE
    all_vectors: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        try:
            response = await client.embeddings.create(
                model=settings.OPENAI_EMBED_MODEL,
                input=batch,
            )
            all_vectors.extend([item.embedding for item in response.data])
        except Exception as e:
            logger.error("Embedding batch %d failed: %s — using zeros", i // batch_size, e)
            all_vectors.extend([[0.0] * 1536 for _ in batch])

    return all_vectors


# ---------------------------------------------------------------------------
# Cosine similarity (used when pgvector is not available)
# ---------------------------------------------------------------------------

def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot   = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ---------------------------------------------------------------------------
# In-memory vector store (fallback when DB is not available)
# ---------------------------------------------------------------------------

class InMemoryVectorStore:
    """
    Lightweight in-memory store for testing / offline mode.
    Stores (chunk_text, vector, metadata) tuples and does brute-force
    cosine search.  Not suitable for production — use pgvector in prod.
    """

    def __init__(self) -> None:
        self._entries: list[dict] = []

    def add(self, chunk: str, vector: list[float], metadata: dict) -> None:
        self._entries.append({"chunk": chunk, "vector": vector, "metadata": metadata})

    def search(self, query_vector: list[float], top_k: int = 5) -> list[dict]:
        scored = [
            {**e, "score": cosine_similarity(query_vector, e["vector"])}
            for e in self._entries
        ]
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    def __len__(self) -> int:
        return len(self._entries)


# Module-level fallback store (used when DB is unavailable)
_fallback_store = InMemoryVectorStore()


# ---------------------------------------------------------------------------
# Ingest
# ---------------------------------------------------------------------------

async def ingest_document(
    document_id: str,
    title: str,
    text: str,
    doc_type: str = "dev_plan",
    ward_id: Optional[str] = None,
    db=None,                          # AsyncSession — optional, falls back to in-memory
) -> dict:
    """
    Chunk, embed, and store a document for later RAG retrieval.

    Args:
        document_id: UUID of the parent Document row
        title:       Human-readable title (used in retrieved context)
        text:        Full extracted text of the document
        doc_type:    "dev_plan" | "census" | "school_data" | etc.
        ward_id:     Optional ward this document relates to
        db:          SQLAlchemy AsyncSession — if None, falls back to in-memory store

    Returns:
        {"document_id": ..., "chunks_stored": N, "store": "pgvector"|"memory"}
    """
    if not text or not text.strip():
        logger.warning("ingest_document: empty text for document %s — skipping", document_id)
        return {"document_id": document_id, "chunks_stored": 0, "store": "none"}

    chunks  = chunk_text(text)
    vectors = await embed_texts(chunks)

    logger.info("Ingesting document %s → %d chunks", document_id, len(chunks))

    if db is not None:
        stored = await _store_in_pgvector(document_id, title, doc_type, ward_id, chunks, vectors, db)
        return {"document_id": document_id, "chunks_stored": stored, "store": "pgvector"}
    else:
        for chunk, vector in zip(chunks, vectors):
            _fallback_store.add(
                chunk  = chunk,
                vector = vector,
                metadata = {
                    "document_id": document_id,
                    "title":       title,
                    "doc_type":    doc_type,
                    "ward_id":     ward_id,
                },
            )
        logger.info("Stored %d chunks in in-memory store", len(chunks))
        return {"document_id": document_id, "chunks_stored": len(chunks), "store": "memory"}


async def _store_in_pgvector(
    document_id: str,
    title: str,
    doc_type: str,
    ward_id: Optional[str],
    chunks: list[str],
    vectors: list[list[float]],
    db,
) -> int:
    """Insert chunk rows into document_chunks table using pgvector."""
    from sqlalchemy import text as sql_text

    # Ensure the chunks table exists (idempotent — created by migration)
    stored = 0
    for chunk, vector in zip(chunks, vectors):
        chunk_id = str(uuid.uuid4())
        vector_str = "[" + ",".join(str(v) for v in vector) + "]"
        try:
            await db.execute(
                sql_text("""
                    INSERT INTO document_chunks
                        (id, document_id, title, doc_type, ward_id, chunk_text, embedding)
                    VALUES
                        (:id, :doc_id, :title, :doc_type, :ward_id, :chunk_text, :embedding::vector)
                    ON CONFLICT (id) DO NOTHING
                """),
                {
                    "id":         chunk_id,
                    "doc_id":     document_id,
                    "title":      title,
                    "doc_type":   doc_type,
                    "ward_id":    ward_id,
                    "chunk_text": chunk,
                    "embedding":  vector_str,
                },
            )
            stored += 1
        except Exception as e:
            logger.error("Failed to store chunk %s: %s", chunk_id, e)

    return stored


# ---------------------------------------------------------------------------
# Query / Retrieve
# ---------------------------------------------------------------------------

async def query_documents(
    question: str,
    ward_id: Optional[str] = None,
    top_k: int = None,
    db=None,
) -> list[dict]:
    """
    Retrieve the most relevant document chunks for a question.

    Args:
        question: Natural-language question (e.g. "Are there plans for a school in Ward 3?")
        ward_id:  Optionally restrict retrieval to chunks from this ward
        top_k:    Number of chunks to return (default: settings.RAG_TOP_K)
        db:       AsyncSession — if None, searches in-memory store

    Returns:
        List of dicts: [{"chunk": str, "score": float, "metadata": {...}}, ...]
    """
    top_k = top_k or settings.RAG_TOP_K

    if not question.strip():
        return []

    vectors = await embed_texts([question])
    query_vector = vectors[0]

    if db is not None:
        return await _search_pgvector(query_vector, ward_id, top_k, db)
    else:
        results = _fallback_store.search(query_vector, top_k)
        if ward_id:
            results = [r for r in results if r["metadata"].get("ward_id") in (ward_id, None)]
        return results


async def _search_pgvector(
    query_vector: list[float],
    ward_id: Optional[str],
    top_k: int,
    db,
) -> list[dict]:
    from sqlalchemy import text as sql_text

    vector_str  = "[" + ",".join(str(v) for v in query_vector) + "]"
    ward_clause = "AND ward_id = :ward_id" if ward_id else ""

    try:
        result = await db.execute(
            sql_text(f"""
                SELECT chunk_text, title, doc_type, ward_id,
                       1 - (embedding <=> :embedding::vector) AS score
                FROM   document_chunks
                WHERE  1=1 {ward_clause}
                ORDER  BY embedding <=> :embedding::vector
                LIMIT  :top_k
            """),
            {"embedding": vector_str, "ward_id": ward_id, "top_k": top_k},
        )
        rows = result.fetchall()
        return [
            {
                "chunk":    row.chunk_text,
                "score":    float(row.score),
                "metadata": {
                    "title":    row.title,
                    "doc_type": row.doc_type,
                    "ward_id":  row.ward_id,
                },
            }
            for row in rows
        ]
    except Exception as e:
        logger.error("pgvector search failed: %s", e)
        return []
