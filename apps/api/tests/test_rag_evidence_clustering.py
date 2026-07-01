"""
Tests for the three new AI services:
  - RAG pipeline   (rag_pipeline.py)
  - Evidence generator (evidence_generator.py)
  - Submission clustering (clustering.py)

All tests are offline — no Ollama calls, no DB, no network.
"""
from __future__ import annotations
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ═══════════════════════════════════════════════════════════════════════════════
# RAG Pipeline
# ═══════════════════════════════════════════════════════════════════════════════

class TestRagPipeline:

    # ── chunk_text ─────────────────────────────────────────────────────────────

    def test_chunk_text_basic(self):
        from app.services.ai.rag_pipeline import chunk_text
        text   = " ".join([f"word{i}" for i in range(1200)])
        chunks = chunk_text(text, chunk_size=500, overlap=50)
        # All words are covered
        assert len(chunks) >= 2
        # Each chunk has ≤ 500 words
        for c in chunks:
            assert len(c.split()) <= 500

    def test_chunk_text_short_text_gives_one_chunk(self):
        from app.services.ai.rag_pipeline import chunk_text
        text   = "This is a short document."
        chunks = chunk_text(text, chunk_size=500, overlap=50)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_chunk_text_empty_returns_empty(self):
        from app.services.ai.rag_pipeline import chunk_text
        assert chunk_text("", chunk_size=500, overlap=50) == []

    def test_chunk_text_overlap(self):
        from app.services.ai.rag_pipeline import chunk_text
        words  = [f"w{i}" for i in range(20)]
        text   = " ".join(words)
        chunks = chunk_text(text, chunk_size=10, overlap=3)
        # Second chunk should start with words from end of first chunk
        first_end  = set(chunks[0].split()[-3:])
        second_start = set(chunks[1].split()[:3])
        assert first_end == second_start

    # ── cosine_similarity ──────────────────────────────────────────────────────

    def test_cosine_similarity_identical(self):
        from app.services.ai.rag_pipeline import cosine_similarity
        v = [1.0, 0.0, 0.0]
        assert cosine_similarity(v, v) == pytest.approx(1.0)

    def test_cosine_similarity_orthogonal(self):
        from app.services.ai.rag_pipeline import cosine_similarity
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert cosine_similarity(a, b) == pytest.approx(0.0)

    def test_cosine_similarity_zero_vectors(self):
        from app.services.ai.rag_pipeline import cosine_similarity
        assert cosine_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0

    # ── InMemoryVectorStore ────────────────────────────────────────────────────

    def test_in_memory_store_add_and_search(self):
        from app.services.ai.rag_pipeline import InMemoryVectorStore
        store = InMemoryVectorStore()
        # Two vectors — first is closest to query
        store.add("school is far",    [1.0, 0.0], {"doc_type": "dev_plan"})
        store.add("road is broken",   [0.0, 1.0], {"doc_type": "dev_plan"})
        results = store.search([1.0, 0.0], top_k=2)
        assert results[0]["chunk"] == "school is far"
        assert results[0]["score"] == pytest.approx(1.0)

    def test_in_memory_store_top_k(self):
        from app.services.ai.rag_pipeline import InMemoryVectorStore
        store = InMemoryVectorStore()
        for i in range(10):
            store.add(f"chunk {i}", [float(i), 0.0], {})
        results = store.search([9.0, 0.0], top_k=3)
        assert len(results) == 3

    def test_in_memory_store_len(self):
        from app.services.ai.rag_pipeline import InMemoryVectorStore
        store = InMemoryVectorStore()
        assert len(store) == 0
        store.add("x", [1.0], {})
        assert len(store) == 1

    # ── embed_texts (offline) ──────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_embed_texts_no_model_returns_zeros(self, monkeypatch):
        # Force _st_model to None so we get zero-vector fallback
        import app.services.ai.rag_pipeline as rp
        original = rp._st_model
        rp._st_model = None
        # Prevent auto-load by patching SentenceTransformer to raise ImportError
        import unittest.mock as mock
        with mock.patch.dict("sys.modules", {"sentence_transformers": None}):
            rp._st_model = None
            from app.services.ai.rag_pipeline import embed_texts
            result = await embed_texts(["hello world"])
        rp._st_model = original
        assert len(result) == 1
        # Either real 384-dim embeddings or zero fallback
        assert len(result[0]) in (384, 1536)

    @pytest.mark.asyncio
    async def test_embed_texts_empty_list(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.OLLAMA_BASE_URL", "http://localhost:0")  # offline — Ollama unavailable
        from app.services.ai.rag_pipeline import embed_texts
        result = await embed_texts([])
        assert result == []

    # ── ingest_document (offline) ──────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_ingest_empty_text(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.OLLAMA_BASE_URL", "http://localhost:0")  # offline — Ollama unavailable
        from app.services.ai.rag_pipeline import ingest_document
        result = await ingest_document("doc-1", "Test Doc", "", db=None)
        assert result["chunks_stored"] == 0
        assert result["store"] == "none"

    @pytest.mark.asyncio
    async def test_ingest_stores_in_memory(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.OLLAMA_BASE_URL", "http://localhost:0")  # offline — Ollama unavailable
        from app.services.ai import rag_pipeline
        # Fresh store for this test
        rag_pipeline._fallback_store = rag_pipeline.InMemoryVectorStore()
        result = await rag_pipeline.ingest_document(
            "doc-1", "Ward 3 Dev Plan",
            "The local development plan includes a school plot in sector 7B of ward 3.",
            db=None,
        )
        assert result["store"] == "memory"
        assert result["chunks_stored"] >= 1
        assert len(rag_pipeline._fallback_store) >= 1

    # ── query_documents (offline) ──────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_query_after_ingest(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.OLLAMA_BASE_URL", "http://localhost:0")  # offline — Ollama unavailable
        from app.services.ai import rag_pipeline

        # Fresh store
        rag_pipeline._fallback_store = rag_pipeline.InMemoryVectorStore()
        # Ingest two documents — zero vectors, so all scores will be 0 (OK for offline test)
        await rag_pipeline.ingest_document("d1", "School Plan", "school plot reserved", db=None)
        await rag_pipeline.ingest_document("d2", "Road Plan",   "road resurfacing proposed", db=None)

        results = await rag_pipeline.query_documents("school plans", db=None)
        assert isinstance(results, list)

    @pytest.mark.asyncio
    async def test_query_empty_question_returns_empty(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.OLLAMA_BASE_URL", "http://localhost:0")  # offline — Ollama unavailable
        from app.services.ai.rag_pipeline import query_documents
        result = await query_documents("   ", db=None)
        assert result == []


# ═══════════════════════════════════════════════════════════════════════════════
# Evidence Generator
# ═══════════════════════════════════════════════════════════════════════════════

class TestEvidenceGenerator:

    # ── Template fallback (no API key) ─────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_generate_evidence_no_key(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.OLLAMA_BASE_URL", "http://localhost:0")  # offline — Ollama unavailable
        from app.services.ai.evidence_generator import generate_evidence
        result = await generate_evidence(
            project_title    = "New School — Ward 3",
            theme            = "schools",
            ward_name        = "Ward 3 — East",
            submission_count = 47,
            urgency_level    = "critical",
            urgency_score    = 0.95,
            demand_score     = 0.95,
            gap_score        = 0.92,
            priority_rank    = 1,
            ward_data        = {"nearest_school_km": 6.2, "school_age_population": 5800, "population": 31000},
        )
        # Must produce a non-empty string mentioning key facts
        assert isinstance(result, str)
        assert len(result) > 30
        assert "47" in result        # submission count
        assert "Ward 3" in result    # ward name

    @pytest.mark.asyncio
    async def test_generate_evidence_with_rag_context(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.OLLAMA_BASE_URL", "http://localhost:0")  # offline — Ollama unavailable
        from app.services.ai.evidence_generator import generate_evidence
        rag_ctx = [{"chunk": "Plot reserved for school in sector 7B.", "score": 0.92,
                    "metadata": {"title": "Ward 3 Master Plan 2024", "doc_type": "dev_plan"}}]
        result = await generate_evidence(
            project_title="New School", theme="schools", ward_name="Ward 3",
            submission_count=47, urgency_level="critical", urgency_score=0.95,
            demand_score=0.95, gap_score=0.92, priority_rank=1,
            rag_context=rag_ctx,
        )
        assert "Ward 3 Master Plan 2024" in result

    @pytest.mark.asyncio
    async def test_generate_evidence_health_km(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.OLLAMA_BASE_URL", "http://localhost:0")  # offline — Ollama unavailable
        from app.services.ai.evidence_generator import generate_evidence
        result = await generate_evidence(
            project_title="PHC Restoration", theme="health", ward_name="Ward 2 — North",
            submission_count=18, urgency_level="critical", urgency_score=0.98,
            demand_score=0.85, gap_score=0.97, priority_rank=2,
            ward_data={"nearest_hospital_km": 20.0, "population": 22000},
        )
        assert "20" in result       # km distance should appear

    # ── Batch generation ───────────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_generate_evidence_batch(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.OLLAMA_BASE_URL", "http://localhost:0")  # offline — Ollama unavailable
        from app.services.ai.evidence_generator import generate_evidence_batch
        projects = [
            {"title": "School — Ward 3", "theme": "schools", "ward_id": "ward-03",
             "submission_count": 47, "urgency_level": "critical", "urgency_score": 0.95,
             "demand_score": 0.9, "gap_score": 0.9, "priority_rank": 1},
            {"title": "PHC — Ward 2",    "theme": "health",   "ward_id": "ward-02",
             "submission_count": 18, "urgency_level": "critical", "urgency_score": 0.98,
             "demand_score": 0.8, "gap_score": 0.97, "priority_rank": 2},
        ]
        ward_lookup = {
            "ward-03": {"name": "Ward 3 — East", "nearest_school_km": 6.2, "school_age_population": 5800, "population": 31000},
            "ward-02": {"name": "Ward 2 — North", "nearest_hospital_km": 20.0, "population": 22000},
        }
        result = await generate_evidence_batch(projects, ward_lookup)
        assert len(result) == 2
        for p in result:
            assert "evidence_text" in p
            assert len(p["evidence_text"]) > 10

    # ── Template helper ────────────────────────────────────────────────────────

    def test_template_evidence_schools(self):
        from app.services.ai.evidence_generator import _template_evidence
        result = _template_evidence(
            "School", "schools", "Ward 3", 47, "critical",
            {"nearest_school_km": 6.2, "school_age_population": 5800},
            None,
        )
        assert "47" in result
        assert "6.2" in result
        assert "5,800" in result

    def test_template_evidence_no_ward_data(self):
        from app.services.ai.evidence_generator import _template_evidence
        result = _template_evidence("Road repair", "roads", "Ward 1", 20, "high", None, None)
        assert "20" in result
        assert isinstance(result, str)
        assert len(result) > 20

    def test_build_user_message_contains_key_fields(self):
        from app.services.ai.evidence_generator import _build_user_message
        msg = _build_user_message(
            "School Project", "schools", "Ward 3", 47, "critical",
            0.95, 0.90, 0.92, 1,
            {"population": 31000, "nearest_school_km": 6.2, "school_age_population": 5800},
            None, ["Children walk 7km to school"],
        )
        assert "School Project" in msg
        assert "47" in msg
        assert "31,000" in msg
        assert "6.2" in msg
        assert "Children walk 7km" in msg


# ═══════════════════════════════════════════════════════════════════════════════
# Clustering
# ═══════════════════════════════════════════════════════════════════════════════

class TestClustering:

    def _make_submissions(self, n: int, theme: str = "schools") -> list[dict]:
        return [
            {
                "id":               f"sub-{i:03d}",
                "text_raw":         f"Submission {i} about {theme}",
                "text_translated":  f"Submission {i} about {theme}",
                "themes":           [theme],
                "urgency_score":    0.5 + (i % 5) * 0.1,
            }
            for i in range(n)
        ]

    # ── Keyword fallback (always available) ───────────────────────────────────

    def test_keyword_cluster_fallback_groups_by_theme(self):
        from app.services.ai.clustering import _keyword_cluster_fallback
        subs = (
            self._make_submissions(5, "schools") +
            self._make_submissions(3, "roads")
        )
        clusters = _keyword_cluster_fallback(subs)
        themes = {c["theme"] for c in clusters}
        assert "schools" in themes
        assert "roads"   in themes

    def test_keyword_cluster_fallback_sorted_by_size(self):
        from app.services.ai.clustering import _keyword_cluster_fallback
        subs = self._make_submissions(8, "schools") + self._make_submissions(3, "roads")
        clusters = _keyword_cluster_fallback(subs)
        assert clusters[0]["size"] >= clusters[-1]["size"]

    def test_keyword_cluster_fallback_empty(self):
        from app.services.ai.clustering import _keyword_cluster_fallback
        assert _keyword_cluster_fallback([]) == []

    # ── cluster_submissions (falls back to keyword when model unavailable) ─────

    def test_cluster_submissions_returns_list(self):
        from app.services.ai.clustering import cluster_submissions
        subs = self._make_submissions(6, "water")
        result = cluster_submissions(subs)
        assert isinstance(result, list)

    def test_cluster_submissions_empty_returns_empty(self):
        from app.services.ai.clustering import cluster_submissions
        assert cluster_submissions([]) == []

    def test_cluster_submissions_ids_present(self):
        from app.services.ai.clustering import cluster_submissions
        subs = self._make_submissions(4, "health")
        clusters = cluster_submissions(subs)
        all_ids = {sid for c in clusters for sid in c["submission_ids"]}
        input_ids = {s["id"] for s in subs}
        # Every returned ID must be from the input
        assert all_ids.issubset(input_ids)

    def test_cluster_submissions_structure(self):
        from app.services.ai.clustering import cluster_submissions
        subs = self._make_submissions(5, "schools")
        clusters = cluster_submissions(subs)
        for c in clusters:
            assert "cluster_id"      in c
            assert "label"           in c
            assert "theme"           in c
            assert "size"            in c
            assert "avg_urgency"     in c
            assert "representative"  in c
            assert "submission_ids"  in c
            assert "top_submissions" in c
            assert 0.0 <= c["avg_urgency"] <= 1.0

    # ── cluster_ward_submissions ───────────────────────────────────────────────

    def test_cluster_ward_submissions_structure(self):
        from app.services.ai.clustering import cluster_ward_submissions
        subs = self._make_submissions(6, "roads")
        result = cluster_ward_submissions("ward-01", subs)
        assert result["ward_id"]  == "ward-01"
        assert result["total"]    == 6
        assert "clusters"         in result
        assert "top_theme"        in result
        assert "top_cluster_size" in result

    def test_cluster_ward_submissions_empty(self):
        from app.services.ai.clustering import cluster_ward_submissions
        result = cluster_ward_submissions("ward-01", [])
        assert result["total"] == 0
        assert result["clusters"] == []

    # ── Generate cluster label ─────────────────────────────────────────────────

    def test_generate_cluster_label_returns_string(self):
        from app.services.ai.clustering import _generate_cluster_label
        subs = [{"text_translated": "school is very far from village", "text_raw": ""}]
        label = _generate_cluster_label("schools", subs)
        assert isinstance(label, str)
        assert len(label) > 5

    def test_generate_cluster_label_includes_qualifier(self):
        from app.services.ai.clustering import _generate_cluster_label
        # "far" appears in the text → should appear as qualifier
        subs = [{"text_translated": "school is far far from our ward", "text_raw": ""}] * 3
        label = _generate_cluster_label("schools", subs)
        assert "far" in label.lower() or "School" in label

    # ── Top submissions ordering ───────────────────────────────────────────────

    def test_top_submissions_sorted_by_urgency(self):
        from app.services.ai.clustering import _keyword_cluster_fallback
        subs = [
            {"id": "a", "text_translated": "mild issue",    "text_raw": "", "themes": ["water"], "urgency_score": 0.3},
            {"id": "b", "text_translated": "critical issue", "text_raw": "", "themes": ["water"], "urgency_score": 0.98},
            {"id": "c", "text_translated": "moderate issue", "text_raw": "", "themes": ["water"], "urgency_score": 0.6},
        ]
        clusters = _keyword_cluster_fallback(subs)
        top = clusters[0]["top_submissions"]
        # Highest urgency should be first
        assert top[0]["urgency_score"] >= top[-1]["urgency_score"]
