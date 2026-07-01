"""
Tests for the AI pipeline services.

These tests run without any external API — all calls use Ollama (local)
or fall back gracefully when Ollama is not running.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ─── theme_extractor ──────────────────────────────────────────────────────────

class TestThemeExtractor:
    """Test Ollama-based theme extraction."""

    @pytest.mark.asyncio
    async def test_extract_themes_ollama_unavailable(self, monkeypatch):
        """Falls back gracefully when Ollama is not reachable."""
        monkeypatch.setattr("app.core.config.settings.OLLAMA_BASE_URL", "http://localhost:0")
        from app.services.ai.theme_extractor import extract_themes
        result = await extract_themes("The road is broken")
        assert result["themes"] == ["other"]
        assert result["urgency_level"] == "medium"
        assert "urgency_score" in result
        assert "summary" in result

    def test_extract_themes_success_via_validate(self):
        """_validate produces correct output from valid Ollama JSON."""
        from app.services.ai.theme_extractor import _validate
        result = _validate(
            {"themes": ["schools", "roads"], "urgency_score": 0.82,
             "urgency_level": "high", "summary": "School too far."},
            "Children cannot reach school"
        )
        assert "schools" in result["themes"]
        assert result["urgency_level"] == "high"
        assert 0.0 <= result["urgency_score"] <= 1.0

    @pytest.mark.asyncio
    async def test_extract_themes_bad_connection_falls_back(self, monkeypatch):
        """Falls back to default when Ollama endpoint is unreachable."""
        monkeypatch.setattr("app.core.config.settings.OLLAMA_BASE_URL", "http://localhost:0")
        from app.services.ai.theme_extractor import extract_themes
        result = await extract_themes("Some text")
        assert result["themes"] == ["other"]

    def test_validate_clamps_score(self):
        """_validate handles Ollama 0-10 scale and clamps to [0, 1]."""
        from app.services.ai.theme_extractor import _validate
        # Ollama sometimes returns 0-10 scale — normalise to 0-1
        result = _validate({"themes": ["schools"], "urgency_score": 9.5, "urgency_level": "critical", "summary": "x"}, "x")
        assert result["urgency_score"] <= 1.0

        # Standard 0–1 passthrough (no normalisation needed)
        result = _validate({"themes": ["schools"], "urgency_score": 0.95, "urgency_level": "high", "summary": "x"}, "x")
        assert result["urgency_score"] == 0.95

        # Negative clamped to 0.0
        result = _validate({"themes": ["schools"], "urgency_score": -0.5, "urgency_level": "low", "summary": "x"}, "x")
        assert result["urgency_score"] == 0.0

    def test_validate_filters_invalid_themes(self):
        """_validate removes unknown theme keys and falls back to 'other'."""
        from app.services.ai.theme_extractor import _validate
        result = _validate({"themes": ["flying_cars", "schools"], "urgency_score": 0.5, "urgency_level": "medium", "summary": "x"}, "x")
        assert "flying_cars" not in result["themes"]
        assert "schools" in result["themes"]

    def test_score_to_level(self):
        from app.services.ai.theme_extractor import _score_to_level
        assert _score_to_level(0.90) == "critical"
        assert _score_to_level(0.70) == "high"
        assert _score_to_level(0.50) == "medium"
        assert _score_to_level(0.20) == "low"


# ─── transcriber ──────────────────────────────────────────────────────────────

class TestTranscriber:
    @pytest.mark.asyncio
    async def test_transcribe_empty_bytes(self):
        """Falls back to empty string when given empty audio bytes."""
        from app.services.ai.transcriber import transcribe_audio
        result = await transcribe_audio(b"", "test.webm")
        assert result == {"text": "", "lang": "en"}

    def test_normalise_lang_full_name(self):
        from app.services.ai.transcriber import _normalise_lang
        assert _normalise_lang("hindi")   == "hi"
        assert _normalise_lang("english") == "en"
        assert _normalise_lang("marathi") == "mr"

    def test_normalise_lang_iso_passthrough(self):
        from app.services.ai.transcriber import _normalise_lang
        assert _normalise_lang("hi") == "hi"
        assert _normalise_lang("en") == "en"


# ─── translator ───────────────────────────────────────────────────────────────

class TestTranslator:
    def test_detect_language_english(self):
        from app.services.ai.translator import detect_language
        lang = detect_language("The road to our village is broken")
        assert lang == "en"

    def test_detect_language_empty(self):
        from app.services.ai.translator import detect_language
        assert detect_language("") == "en"
        assert detect_language("   ") == "en"

    def test_translate_english_passthrough(self):
        """English text is returned as-is without any translation API call."""
        from app.services.ai.translator import translate_to_english
        text = "Hello world"
        assert translate_to_english(text, "en") == text

    def test_translate_empty_passthrough(self):
        from app.services.ai.translator import translate_to_english
        assert translate_to_english("", "hi") == ""

    def test_detect_and_translate_english(self):
        from app.services.ai.translator import detect_and_translate
        result = detect_and_translate("The school is too far away")
        assert result["lang_detected"] == "en"
        assert result["text_translated"] == "The school is too far away"


# ─── scorer ───────────────────────────────────────────────────────────────────

class TestScorer:
    def test_compute_priority_score_formula(self):
        from app.services.ai.scorer import compute_priority_score
        # 0.4×1 + 0.35×1 + 0.15×1 + 0.1×1 = 1.0
        assert compute_priority_score(1.0, 1.0, 1.0, 1.0) == 1.0
        assert compute_priority_score(0.0, 0.0, 0.0, 0.0) == 0.0

    def test_compute_priority_score_weighted(self):
        from app.services.ai.scorer import compute_priority_score
        # demand dominates
        high_demand = compute_priority_score(1.0, 0.0, 0.0, 0.0)
        high_gap    = compute_priority_score(0.0, 1.0, 0.0, 0.0)
        assert high_demand > high_gap  # demand weight (0.40) > gap weight (0.35)

    def test_compute_priority_score_clamped(self):
        from app.services.ai.scorer import compute_priority_score
        assert compute_priority_score(2.0, 2.0, 2.0, 2.0) == 1.0
        assert compute_priority_score(-1.0, -1.0, -1.0, -1.0) == 0.0

    def test_compute_demand_score(self):
        from app.services.ai.scorer import compute_demand_score
        assert compute_demand_score(47, 47) == 1.0
        assert compute_demand_score(0,  47) == 0.0
        assert compute_demand_score(23, 47) == pytest.approx(0.4894, rel=1e-2)

    def test_compute_demand_score_zero_max(self):
        from app.services.ai.scorer import compute_demand_score
        assert compute_demand_score(10, 0) == 0.0

    def test_compute_gap_score_schools(self):
        from app.services.ai.scorer import compute_gap_score
        score = compute_gap_score("schools", {"nearest_school_km": 6.2})
        assert score > 0.5

        score = compute_gap_score("schools", {"nearest_school_km": 0.5})
        assert score < 0.5

    def test_compute_gap_score_health(self):
        from app.services.ai.scorer import compute_gap_score
        score = compute_gap_score("health", {"nearest_hospital_km": 20.0})
        assert score > 0.6

    def test_compute_gap_score_other(self):
        from app.services.ai.scorer import compute_gap_score
        score = compute_gap_score("other", {})
        assert score == 0.5

    def test_compute_feasibility_score(self):
        from app.services.ai.scorer import compute_feasibility_score
        assert compute_feasibility_score(in_dev_plan=True, ward_has_boundary=True)  == 1.0
        assert compute_feasibility_score(in_dev_plan=False, ward_has_boundary=False) == 0.30

    def test_rank_projects(self):
        from app.services.ai.scorer import rank_projects
        projects = [
            {"demand_score": 0.3, "gap_score": 0.3, "feasibility_score": 0.5, "urgency_score": 0.5},
            {"demand_score": 0.9, "gap_score": 0.9, "feasibility_score": 0.9, "urgency_score": 0.9},
            {"demand_score": 0.6, "gap_score": 0.6, "feasibility_score": 0.6, "urgency_score": 0.6},
        ]
        ranked = rank_projects(projects)
        assert ranked[0]["priority_rank"] == 1
        assert ranked[0]["priority_score"] > ranked[1]["priority_score"]
        assert ranked[1]["priority_score"] > ranked[2]["priority_score"]
        assert [p["priority_rank"] for p in ranked] == [1, 2, 3]

    def test_km_to_gap_score_sigmoid(self):
        from app.services.ai.scorer import _km_to_gap_score
        assert _km_to_gap_score(0, 4)  <  0.2
        assert _km_to_gap_score(4, 4)  == pytest.approx(0.5, abs=0.01)
        assert _km_to_gap_score(10, 4) >  0.7
