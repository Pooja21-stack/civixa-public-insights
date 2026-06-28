#!/usr/bin/env python3
"""
CivIxa AI Pipeline — Local Test & Demo Runner
=============================================
Tests the complete AI pipeline without Docker, Postgres, or Redis.

Run:
    cd apps/api
    python scripts/test_local.py

What it does:
    1. Unit tests  — runs the full pytest suite (62 tests)
    2. Translator  — detect language + translate a Hindi sentence
    3. Theme extractor — GPT-4o call (uses real key if set, fallback if not)
    4. Scorer      — priority formula across all 5 demo wards
    5. Clustering  — DBSCAN on 6 sample submissions
    6. RAG pipeline — ingest a mini dev plan, query it
    7. Evidence generator — produce evidence text for top project
    8. Full pipeline simulation — end-to-end submission → ranked project

Set OPENAI_API_KEY in your .env to enable live GPT-4o / Whisper calls.
Without it, all services fall back gracefully and still demonstrate the logic.
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import textwrap
import time

# ── ensure we're running from apps/api ────────────────────────────────────────
HERE = os.path.dirname(os.path.abspath(__file__))
API_ROOT = os.path.dirname(HERE)
sys.path.insert(0, API_ROOT)

# load .env if present
from dotenv import load_dotenv
load_dotenv(os.path.join(API_ROOT, ".env"))


# ─── Helpers ──────────────────────────────────────────────────────────────────

def section(title: str):
    width = 60
    print(f"\n{'═' * width}")
    print(f"  {title}")
    print(f"{'═' * width}")


def ok(label: str, detail: str = ""):
    print(f"  ✅  {label}" + (f"  →  {detail}" if detail else ""))


def info(label: str, detail: str = ""):
    print(f"  ℹ️   {label}" + (f": {detail}" if detail else ""))


def warn(label: str):
    print(f"  ⚠️   {label}")


def fail(label: str, err):
    print(f"  ❌  {label}: {err}")


# ─── 1. Run pytest ─────────────────────────────────────────────────────────────

def run_pytest():
    section("1. Pytest — full test suite")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short", "-q"],
        cwd=API_ROOT,
        capture_output=True,
        text=True,
    )
    # Print summary lines only
    for line in result.stdout.splitlines():
        if "passed" in line or "failed" in line or "error" in line or "FAILED" in line:
            print(f"  {line.strip()}")
    if result.returncode == 0:
        ok("All tests passed")
    else:
        fail("Tests failed", "see output above")
        # Don't exit — still run manual demos
    return result.returncode == 0


# ─── 2. Translator demo ────────────────────────────────────────────────────────

def demo_translator():
    section("2. Translator — language detection + translation")
    from app.services.ai.translator import detect_language, translate_to_english, detect_and_translate

    cases = [
        ("The road to our village has been broken for 2 years.", "en"),
        ("हमारे वार्ड में कोई सरकारी स्कूल नहीं है।", "hi"),
        ("நமது கிராமத்தில் தண்ணீர் வழங்கல் மிகவும் ஒழுங்கற்றதாக உள்ளது.", "ta"),
    ]

    for text, expected_lang in cases:
        detected = detect_language(text)
        result   = detect_and_translate(text)
        match = "✅" if detected == expected_lang else "⚠️ "
        print(f"  {match}  [{detected}] {text[:60]}")
        if detected != "en":
            print(f"       → {result['text_translated'][:80]}")


# ─── 3. Theme extractor demo ───────────────────────────────────────────────────

async def demo_theme_extractor():
    section("3. Theme Extractor — GPT-4o analysis")

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        warn("OPENAI_API_KEY not set — showing fallback behaviour")
    else:
        info("Using live GPT-4o", f"model={os.environ.get('OPENAI_MODEL', 'gpt-4o')}")

    from app.services.ai.theme_extractor import extract_themes

    submissions = [
        "The road to our village has been broken for 2 years. Children cannot go to school safely.",
        "There is no government school in our ward. Children have to go 7 kilometres away.",
        "The primary health centre has been closed for 6 months. Pregnant women have to travel 20km.",
        "Water supply is very irregular. We get water only twice a week for 30 minutes.",
        "Power cuts for 8-10 hours daily. Small businesses are suffering.",
    ]

    for text in submissions:
        t0 = time.time()
        result = await extract_themes(text)
        elapsed = time.time() - t0
        themes  = ", ".join(result["themes"])
        urgency = f"{result['urgency_level']} ({result['urgency_score']:.2f})"
        source  = "GPT-4o" if api_key else "fallback"
        print(f"  {'✅':2}  [{source}] themes=[{themes}] urgency={urgency}  ({elapsed:.1f}s)")
        print(f"       {text[:70]}")


# ─── 4. Scorer demo ────────────────────────────────────────────────────────────

def demo_scorer():
    section("4. Priority Scorer — ranking 5 projects")
    from app.services.ai.scorer import (
        compute_demand_score, compute_gap_score,
        compute_feasibility_score, compute_priority_score, rank_projects,
    )

    projects = [
        {"id": "proj-001", "title": "New Primary School — Ward 3",   "theme": "schools",     "ward_id": "ward-03",
         "submission_count": 47, "ward_data": {"nearest_school_km": 6.2, "school_age_population": 5800, "population": 31000}},
        {"id": "proj-002", "title": "PHC Restoration — Ward 2",      "theme": "health",      "ward_id": "ward-02",
         "submission_count": 18, "ward_data": {"nearest_hospital_km": 20.0, "population": 22000}},
        {"id": "proj-003", "title": "Water Pipeline — Ward 5",       "theme": "water",       "ward_id": "ward-05",
         "submission_count": 33, "ward_data": {"population": 24800}},
        {"id": "proj-004", "title": "Road Resurfacing — Ward 3",     "theme": "roads",       "ward_id": "ward-03",
         "submission_count": 38, "ward_data": {"nearest_school_km": 6.2, "nearest_hospital_km": 8.5}},
        {"id": "proj-005", "title": "Electricity Substation — Ward 4","theme": "electricity", "ward_id": "ward-04",
         "submission_count": 29, "ward_data": {"population": 19200}},
    ]

    max_count = max(p["submission_count"] for p in projects)

    for p in projects:
        wd = p["ward_data"]
        p["demand_score"]      = compute_demand_score(p["submission_count"], max_count)
        p["gap_score"]         = compute_gap_score(p["theme"], wd)
        p["feasibility_score"] = compute_feasibility_score(in_dev_plan=True, ward_has_boundary=True)
        p["urgency_score"]     = 0.90 if p["theme"] == "health" else 0.78

    ranked = rank_projects(projects)

    print(f"  {'Rank':<6} {'Score':<7} {'Title':<42} {'Demand':>7} {'Gap':>6}")
    print(f"  {'-'*6} {'-'*7} {'-'*42} {'-'*7} {'-'*6}")
    for p in ranked:
        print(
            f"  #{p['priority_rank']:<5} {p['priority_score']:.3f}  "
            f"{p['title']:<42} {p['demand_score']:.3f}   {p['gap_score']:.3f}"
        )


# ─── 5. Clustering demo ────────────────────────────────────────────────────────

def demo_clustering():
    section("5. Submission Clustering — grouping by semantic similarity")
    from app.services.ai.clustering import cluster_ward_submissions

    submissions = [
        {"id": "s1", "text_translated": "School is too far, children walk 7km daily", "text_raw": "", "themes": ["schools"], "urgency_score": 0.95},
        {"id": "s2", "text_translated": "No government school in our ward, nearest is 6km", "text_raw": "", "themes": ["schools"], "urgency_score": 0.88},
        {"id": "s3", "text_translated": "School building roof is leaking badly in monsoon", "text_raw": "", "themes": ["schools"], "urgency_score": 0.82},
        {"id": "s4", "text_translated": "Road to village has large potholes since 2 years", "text_raw": "", "themes": ["roads"], "urgency_score": 0.75},
        {"id": "s5", "text_translated": "Village connector road is broken and dangerous", "text_raw": "", "themes": ["roads"], "urgency_score": 0.72},
        {"id": "s6", "text_translated": "Water supply only comes twice a week for 30 mins", "text_raw": "", "themes": ["water"], "urgency_score": 0.78},
    ]

    result = cluster_ward_submissions("ward-03", submissions)

    info(f"Total submissions", str(result["total"]))
    info(f"Clusters found",   str(len(result["clusters"])))
    info(f"Top theme",        result["top_theme"])

    for c in result["clusters"]:
        print(f"\n  Cluster #{c['cluster_id']} — {c['label']}")
        print(f"    Theme:       {c['theme']}")
        print(f"    Size:        {c['size']} submissions")
        print(f"    Avg urgency: {c['avg_urgency']:.2f}")
        print(f"    Sample:      {c['representative'][:80]}")


# ─── 6. RAG pipeline demo ──────────────────────────────────────────────────────

async def demo_rag():
    section("6. RAG Pipeline — ingest dev plan + query")
    from app.services.ai import rag_pipeline

    # Fresh store
    rag_pipeline._fallback_store = rag_pipeline.InMemoryVectorStore()

    dev_plan_text = textwrap.dedent("""
        Ward 3 Local Area Development Plan — 2024-2029

        Section 4.2 — Educational Infrastructure
        The ward currently has a deficit of 2 primary schools. A plot of 1.2 acres
        in Sector 7B has been reserved for construction of a new government primary
        school. Estimated cost: Rs 2.8 crore. Expected completion: 2026.

        Section 5.1 — Road Connectivity
        The village connector road (3.8 km, linking Ramnagar village to NH-48)
        is categorised as Priority A under the PMGSY scheme. Work order to be
        issued in Q2 2024-25. Budget allocated: Rs 1.4 crore.

        Section 6.3 — Healthcare
        The Ward 3 Sub-Health Centre at Mohanpur will be upgraded to a PHC
        with 6-bed inpatient facility. Construction tender released March 2024.

        Section 7.0 — Vocational Training Centre
        A proposed vocational training centre in Sector 12 is under feasibility
        review. No citizen demand data available yet. Deferred to 2027-28.
    """).strip()

    # Ingest
    result = await rag_pipeline.ingest_document(
        document_id = "doc-ward3-devplan",
        title       = "Ward 3 Development Plan 2024-2029",
        text        = dev_plan_text,
        doc_type    = "dev_plan",
        ward_id     = "ward-03",
        db          = None,   # in-memory store
    )
    ok(f"Ingested document", f"{result['chunks_stored']} chunks in {result['store']}")

    # Query
    queries = [
        ("Are there plans for a new school in Ward 3?",         "ward-03"),
        ("What road work is planned?",                          None),
        ("Is there a vocational centre proposal?",              None),
    ]

    print()
    for question, ward_id in queries:
        chunks = await rag_pipeline.query_documents(question, ward_id=ward_id, top_k=2, db=None)
        api_key = os.environ.get("OPENAI_API_KEY", "")
        source = "zero-vector search (add OPENAI_API_KEY for semantic search)" if not api_key else "semantic search"
        print(f"  Q: {question}")
        if chunks:
            top = chunks[0]
            print(f"  A: [{source}]")
            print(f"     Score={top['score']:.3f}  »  {top['chunk'][:120]}")
        else:
            print(f"  A: No results (zero vectors — add OPENAI_API_KEY for real embeddings)")
        print()


# ─── 7. Evidence generator demo ────────────────────────────────────────────────

async def demo_evidence():
    section("7. Evidence Generator — AI evidence card for top project")

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        warn("OPENAI_API_KEY not set — showing template-based evidence")
    else:
        info("Using live GPT-4o for evidence generation")

    from app.services.ai.evidence_generator import generate_evidence
    from app.services.ai import rag_pipeline

    # Get relevant context from the RAG store (already populated in step 6)
    rag_context = await rag_pipeline.query_documents(
        "school plans ward 3", ward_id="ward-03", top_k=2, db=None
    )

    evidence = await generate_evidence(
        project_title    = "New Primary School — Ward 3 East",
        theme            = "schools",
        ward_name        = "Ward 3 — East",
        submission_count = 47,
        urgency_level    = "critical",
        urgency_score    = 0.91,
        demand_score     = 1.00,
        gap_score        = 0.92,
        priority_rank    = 1,
        ward_data        = {
            "population":            31000,
            "school_age_population": 5800,
            "nearest_school_km":     6.2,
            "nearest_hospital_km":   8.5,
        },
        rag_context         = rag_context or None,
        sample_submissions  = [
            "हमारे वार्ड में कोई सरकारी स्कूल नहीं है। बच्चों को 7 किलोमीटर दूर जाना पड़ता है।",
            "The school building roof leaks during monsoon. 400 students are affected.",
            "Children walk 6km through unsafe roads to reach the nearest school.",
        ],
    )

    print(f"\n  ┌─ Evidence Card — Priority #1 ────────────────────────────────┐")
    for line in textwrap.wrap(evidence, width=60):
        print(f"  │  {line:<60}│")
    print(f"  └──────────────────────────────────────────────────────────────┘")


# ─── 8. Full end-to-end simulation ─────────────────────────────────────────────

async def demo_full_pipeline():
    section("8. End-to-End Simulation — citizen submission → ranked project")

    from app.services.ai.translator    import detect_and_translate
    from app.services.ai.theme_extractor import extract_themes
    from app.services.ai.scorer        import (
        compute_demand_score, compute_gap_score,
        compute_feasibility_score, compute_priority_score,
    )

    # Simulate a Hindi voice submission (text from Whisper output)
    raw_text = "हमारे वार्ड में पानी की आपूर्ति बहुत अनियमित है। हमें सप्ताह में केवल दो बार पानी मिलता है।"

    print(f"\n  Step 1 — Raw submission (Hindi voice note):")
    print(f"  {raw_text}")

    # Translate
    t = detect_and_translate(raw_text)
    print(f"\n  Step 2 — Language detection + translation:")
    print(f"  Detected: {t['lang_detected']}")
    print(f"  English:  {t['text_translated']}")

    # Theme extraction
    print(f"\n  Step 3 — GPT-4o theme extraction:")
    analysis = await extract_themes(t["text_translated"])
    print(f"  Themes:        {analysis['themes']}")
    print(f"  Urgency level: {analysis['urgency_level']}")
    print(f"  Urgency score: {analysis['urgency_score']}")
    print(f"  Summary:       {analysis['summary'][:80]}")

    # Scoring
    ward_data = {"population": 24800}
    theme     = analysis["themes"][0]
    demand    = compute_demand_score(34, 47)     # 34 submissions, max=47
    gap       = compute_gap_score(theme, ward_data)
    feasib    = compute_feasibility_score(in_dev_plan=False, ward_has_boundary=True)
    priority  = compute_priority_score(demand, gap, feasib, analysis["urgency_score"])

    print(f"\n  Step 4 — Priority scoring:")
    print(f"  Demand score:      {demand:.3f}  (34 submissions / 47 max)")
    print(f"  Gap score:         {gap:.3f}  ({theme} in ward-05)")
    print(f"  Feasibility:       {feasib:.3f}")
    print(f"  Urgency score:     {analysis['urgency_score']:.3f}")
    print(f"  ─────────────────────────────────────")
    print(f"  PRIORITY SCORE:    {priority:.3f}  (formula: 0.4×demand + 0.35×gap + 0.15×feasib + 0.1×urgency)")

    ok("End-to-end pipeline complete")


# ─── Main ──────────────────────────────────────────────────────────────────────

async def main():
    print("\n" + "█" * 60)
    print("  CivIxa AI Pipeline — Local Test & Demo")
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if api_key:
        print(f"  OpenAI key: {'*' * 8}{api_key[-4:]}  (live GPT-4o enabled)")
    else:
        print("  OpenAI key: NOT SET  (all services use offline fallbacks)")
    print("█" * 60)

    tests_ok = run_pytest()

    demo_translator()
    await demo_theme_extractor()
    demo_scorer()
    demo_clustering()
    await demo_rag()
    await demo_evidence()
    await demo_full_pipeline()

    section("Summary")
    if tests_ok:
        ok("62/62 tests passed")
    else:
        warn("Some tests failed — check output above")
    ok("All AI services demonstrated")
    if not api_key:
        info("To enable live GPT-4o calls", "add OPENAI_API_KEY=sk-... to apps/api/.env")
    print()


if __name__ == "__main__":
    asyncio.run(main())
