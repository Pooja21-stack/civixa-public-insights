#!/usr/bin/env python3
"""
test_live_ai.py — Live Ollama AI demo runner.

Tests the full AI pipeline against a running Ollama instance.

Prerequisites:
    ollama serve          # in a separate terminal
    ollama pull mistral   # if not already pulled

Run:
    cd apps/api
    source .venv/bin/activate
    python scripts/test_live_ai.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from app.core.config import settings


async def test_raw_ollama():
    """Test the raw Ollama API call to confirm the model is responding."""
    import urllib.request, json
    print("Testing raw Ollama API...")
    print(f"Base URL: {settings.OLLAMA_BASE_URL}")
    print(f"Model:    {settings.OLLAMA_MODEL}\n")

    payload = json.dumps({
        "model":  settings.OLLAMA_MODEL,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.1, "num_predict": 200},
        "messages": [
            {"role": "system", "content": "Respond with valid JSON only."},
            {
                "role": "user",
                "content": (
                    "Classify this citizen complaint and return JSON:\n"
                    "'The school is 7km away and children cannot walk safely.'\n"
                    'Format: {"themes":["schools"],"urgency_score":0.88,'
                    '"urgency_level":"high","summary":"School too far."}'
                ),
            },
        ],
    }).encode()

    req = urllib.request.Request(
        f"{settings.OLLAMA_BASE_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=settings.OLLAMA_TIMEOUT) as resp:
            body = json.loads(resp.read().decode())
            raw = body["message"]["content"].strip()
            print(f"RAW RESPONSE:\n{raw}\n")
            return True
    except Exception as e:
        print(f"ERROR: {e}")
        print(f"\nIs Ollama running? Try: ollama serve")
        return False


async def test_full_pipeline():
    """Test the full theme extractor service via Ollama."""
    from app.services.ai.theme_extractor import extract_themes
    from app.services.ai.translator import detect_and_translate

    print("=" * 54)
    print("  FULL PIPELINE — 6 submissions (Hindi + English)")
    print("=" * 54)

    test_cases = [
        ("en", "The road to our village has been broken for 2 years. Children cannot go to school safely."),
        ("en", "There is no government school in our ward. Children have to go 7 kilometres away."),
        ("en", "The primary health centre has been closed for 6 months. Pregnant women have to travel 20km."),
        ("en", "Water supply is very irregular. We get water only twice a week for 30 minutes."),
        ("en", "Power cuts for 8-10 hours daily. Small businesses are suffering. Need reliable electricity."),
        ("hi", "हमारे वार्ड में कोई सरकारी स्कूल नहीं है। बच्चों को 7 किलोमीटर दूर जाना पड़ता है।"),
    ]

    for lang, text in test_cases:
        if lang == "hi":
            t = detect_and_translate(text)
            english = t["text_translated"]
            print(f"\n  [HI] {text}")
            print(f"  [EN] {english}")
            analyze_text = english
        else:
            analyze_text = text
            print(f"\n  [EN] {text}")

        r = await extract_themes(analyze_text)
        themes  = ", ".join(r["themes"])
        urgency = f"{r['urgency_level'].upper()} ({r['urgency_score']:.2f})"
        ok = "✅" if r["themes"] != ["other"] else "⚠️  FALLBACK"
        print(f"       {ok}  Themes: [{themes}]  Urgency: {urgency}")
        print(f"              Summary: {r['summary'][:90]}")


async def test_evidence():
    """Test the evidence generator with Ollama."""
    from app.services.ai.evidence_generator import generate_evidence

    print("\n" + "=" * 54)
    print("  EVIDENCE GENERATOR — Ollama Live")
    print("=" * 54)

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
        ward_data={
            "population":            31000,
            "school_age_population": 5800,
            "nearest_school_km":     6.2,
            "nearest_hospital_km":   8.5,
        },
        sample_submissions=[
            "There is no government school in our ward. Children have to go 7 kilometres away.",
            "School building roof leaks in monsoon. 400 students affected.",
            "Children walk 6km through unsafe roads to reach the nearest school.",
        ],
    )

    import textwrap
    print(f"\n  {'─' * 56}")
    for line in textwrap.wrap(evidence, 54):
        print(f"  {line}")
    print(f"  {'─' * 56}")


async def main():
    ok = await test_raw_ollama()
    if ok:
        await test_full_pipeline()
        await test_evidence()
    else:
        print("\nOllama call failed — check that Ollama is running and mistral is pulled.")
        print("  ollama serve")
        print("  ollama pull mistral")


if __name__ == "__main__":
    asyncio.run(main())
