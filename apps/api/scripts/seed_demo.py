#!/usr/bin/env python3
"""
seed_demo.py — Seed the database with realistic demo data for hackathon demo.

Works in two modes:
  1. SQLite (default, no Docker needed):
       python seed_demo.py
       → creates ./demo.db with all tables + demo data

  2. PostgreSQL (Docker running):
       USE_POSTGRES=1 python seed_demo.py
       → seeds the Postgres DB defined in ../.env

After seeding, start the API:
  uvicorn app.main:app --reload --port 8000

Demo accounts created:
  mp@civixa.demo   / demo1234   (role: mp)
  staff@civixa.demo / demo1234  (role: staff)
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

# ── path setup ────────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent.parent))

USE_POSTGRES = os.environ.get("USE_POSTGRES", "0") == "1"

if not USE_POSTGRES:
    # Patch settings before import so SQLAlchemy uses SQLite
    os.environ.setdefault("DB_USER", "")
    os.environ.setdefault("DB_PASS", "")
    os.environ.setdefault("DB_HOST", "")
    os.environ.setdefault("DB_NAME", "")
    os.environ.setdefault("DB_PORT", "5432")
    os.environ.setdefault("SQLITE_URL", "sqlite+aiosqlite:///./demo.db")

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

# ── choose database URL ───────────────────────────────────────────────────────
if USE_POSTGRES:
    from app.core.config import settings
    DATABASE_URL = settings.DATABASE_URL
    print(f"🐘  Using PostgreSQL: {DATABASE_URL}")
else:
    DATABASE_URL = "sqlite+aiosqlite:///./demo.db"
    print(f"📦  Using SQLite: {DATABASE_URL}")

from app.models.base import Base
from app.models.ward import Ward
from app.models.submission import Submission, Channel, UrgencyLevel
from app.models.project import Project, ProjectSource
from app.models.user import User, UserRole
from app.models.document import Document

# ── password hashing (lazy import to avoid bcrypt issues in CI) ───────────────
def _hash(password: str) -> str:
    from app.core.security import get_password_hash
    return get_password_hash(password)


# ── demo data ─────────────────────────────────────────────────────────────────

DEMO_WARDS = [
    {
        "id": "ward-001", "name": "Rajiv Nagar", "constituency": "Pune Central",
        "population": 45000, "school_age_population": 8200,
        "nearest_school_km": 3.2, "nearest_hospital_km": 7.5,
    },
    {
        "id": "ward-002", "name": "Nehru Colony", "constituency": "Pune Central",
        "population": 32000, "school_age_population": 5800,
        "nearest_school_km": 1.5, "nearest_hospital_km": 4.0,
    },
    {
        "id": "ward-003", "name": "Gandhi Nagar", "constituency": "Pune Central",
        "population": 61000, "school_age_population": 11200,
        "nearest_school_km": 4.8, "nearest_hospital_km": 9.2,
    },
    {
        "id": "ward-004", "name": "Shivaji Park", "constituency": "Pune Central",
        "population": 28000, "school_age_population": 4900,
        "nearest_school_km": 2.1, "nearest_hospital_km": 3.5,
    },
]

DEMO_SUBMISSIONS_RAW = [
    # Rajiv Nagar — roads & schools
    ("ward-001", "The main road to Ward 5 has large potholes and is dangerous for schoolchildren.", "roads", "high", 0.75, "web", 18.52, 73.85),
    ("ward-001", "School building near Rajiv Nagar market is falling apart, needs urgent repair.", "schools", "critical", 0.92, "whatsapp", 18.521, 73.851),
    ("ward-001", "हमारे वार्ड में पानी की बहुत कमी है, गर्मियों में पीने का पानी नहीं मिलता।", "water", "high", 0.8, "web", 18.522, 73.852),
    ("ward-001", "There are no streetlights on the main road. It is unsafe at night.", "electricity", "medium", 0.55, "web", 18.523, 73.853),
    ("ward-001", "The government school has only 3 working toilets for 800 students.", "schools", "critical", 0.95, "whatsapp", 18.524, 73.854),
    ("ward-001", "Road from bus stop to colony is waterlogged every monsoon.", "roads", "high", 0.78, "voice", 18.525, 73.855),
    # Nehru Colony — health & water
    ("ward-002", "Primary health centre is closed on Saturdays, patients go to city 30km away.", "health", "high", 0.82, "web", 18.53, 73.87),
    ("ward-002", "The borewell in Nehru Colony has been broken for 3 months.", "water", "critical", 0.91, "whatsapp", 18.531, 73.871),
    ("ward-002", "No ambulance service available. Last month woman died waiting for transport.", "health", "critical", 0.98, "web", 18.532, 73.872),
    ("ward-002", "ನಮ್ಮ ಕಾಲೊನಿಯಲ್ಲಿ ರಸ್ತೆ ತುಂಬಾ ಕೆಟ್ಟದಾಗಿದೆ.", "roads", "medium", 0.6, "web", 18.533, 73.873),
    ("ward-002", "The anganwadi centre has no drinking water facility.", "water", "high", 0.75, "whatsapp", 18.534, 73.874),
    # Gandhi Nagar — schools & electricity
    ("ward-003", "We need more classrooms in Government Primary School #7, classes are overcrowded.", "schools", "high", 0.85, "web", 18.51, 73.86),
    ("ward-003", "Power cuts last 8-10 hours daily, affecting small businesses and students.", "electricity", "high", 0.8, "web", 18.511, 73.861),
    ("ward-003", "No vocational training centre in our ward — youth forced to leave for work.", "schools", "medium", 0.65, "whatsapp", 18.512, 73.862),
    ("ward-003", "बिजली के तार बहुत पुराने हैं, अक्सर शॉर्ट सर्किट होता है।", "electricity", "critical", 0.93, "web", 18.513, 73.863),
    ("ward-003", "Road near Gandhi Chowk is very narrow, trucks block the way.", "roads", "medium", 0.58, "web", 18.514, 73.864),
    ("ward-003", "Teachers absent frequently in schools, students suffer.", "schools", "high", 0.77, "whatsapp", 18.515, 73.865),
    # Shivaji Park — mixed
    ("ward-004", "Drainage pipes are blocked, sewage flows on the street.", "water", "critical", 0.94, "web", 18.54, 73.88),
    ("ward-004", "The park near bus stand is unused. We request a sports ground.", "other", "low", 0.3, "web", 18.541, 73.881),
    ("ward-004", "மருத்துவமனையில் மருந்துகள் கிடைப்பதில்லை.", "health", "high", 0.79, "whatsapp", 18.542, 73.882),
]

DEMO_PROJECTS = [
    {
        "id": "proj-001", "ward_id": "ward-001",
        "title": "Road Repair — Rajiv Nagar Main Road",
        "theme": "roads", "priority_rank": 1, "priority_score": 0.89,
        "demand_score": 0.85, "gap_score": 0.78, "feasibility_score": 0.7, "urgency_score": 0.75,
        "submission_count": 2,
        "evidence_text": "High demand from 2 submissions. Road serves school commuters daily.",
    },
    {
        "id": "proj-002", "ward_id": "ward-001",
        "title": "School Infrastructure Upgrade — Rajiv Nagar",
        "theme": "schools", "priority_rank": 2, "priority_score": 0.92,
        "demand_score": 0.90, "gap_score": 0.85, "feasibility_score": 0.65, "urgency_score": 0.92,
        "submission_count": 2,
        "evidence_text": "Critical urgency. Building safety concerns for 800+ students.",
    },
    {
        "id": "proj-003", "ward_id": "ward-002",
        "title": "Primary Health Centre Extension — Nehru Colony",
        "theme": "health", "priority_rank": 3, "priority_score": 0.88,
        "demand_score": 0.80, "gap_score": 0.88, "feasibility_score": 0.6, "urgency_score": 0.90,
        "submission_count": 2,
        "evidence_text": "Healthcare gap critical. Nearest hospital 30km away, no ambulance.",
    },
    {
        "id": "proj-004", "ward_id": "ward-002",
        "title": "Borewell Restoration — Nehru Colony",
        "theme": "water", "priority_rank": 4, "priority_score": 0.87,
        "demand_score": 0.75, "gap_score": 0.90, "feasibility_score": 0.8, "urgency_score": 0.83,
        "submission_count": 2,
        "evidence_text": "3-month broken borewell affecting thousands in summer.",
    },
    {
        "id": "proj-005", "ward_id": "ward-003",
        "title": "Classroom Construction — Gandhi Nagar School #7",
        "theme": "schools", "priority_rank": 5, "priority_score": 0.83,
        "demand_score": 0.85, "gap_score": 0.80, "feasibility_score": 0.75, "urgency_score": 0.79,
        "submission_count": 3,
        "evidence_text": "Overcrowding confirmed. 3 submissions mention inadequate infrastructure.",
    },
]

DEMO_USERS = [
    {"email": "admin@civixa.demo",  "name": "System Admin",        "role": "admin", "constituency": "Pune Central"},
    {"email": "mp@civixa.demo",     "name": "MP Constituency Rep",  "role": "mp",    "constituency": "Pune Central"},
    {"email": "staff@civixa.demo",  "name": "Office Staff",         "role": "staff", "constituency": "Pune Central"},
]


# ── seeding functions ─────────────────────────────────────────────────────────

async def seed(db: AsyncSession):
    now = datetime.now(timezone.utc)

    # Wards
    print("  📍 Seeding wards...")
    for w in DEMO_WARDS:
        ward = Ward(
            id=w["id"], name=w["name"],
            constituency=w["constituency"],
            population=w["population"],
            school_age_population=w["school_age_population"],
            nearest_school_km=w["nearest_school_km"],
            nearest_hospital_km=w["nearest_hospital_km"],
        )
        db.add(ward)
    await db.flush()

    # Submissions
    print("  📝 Seeding submissions...")

    # Detect language from script ranges — covers all Indian scripts in the seed data
    def _detect_lang(text: str) -> str:
        for ch in text:
            cp = ord(ch)
            if 0x0900 <= cp <= 0x097F: return "hi"   # Devanagari (Hindi/Marathi)
            if 0x0A80 <= cp <= 0x0AFF: return "gu"   # Gujarati
            if 0x0B80 <= cp <= 0x0BFF: return "ta"   # Tamil
            if 0x0C00 <= cp <= 0x0C7F: return "te"   # Telugu
            if 0x0C80 <= cp <= 0x0CFF: return "kn"   # Kannada
            if 0x0980 <= cp <= 0x09FF: return "bn"   # Bengali
            if 0x0A00 <= cp <= 0x0A7F: return "pa"   # Punjabi/Gurmukhi
            if 0x0D00 <= cp <= 0x0D7F: return "ml"   # Malayalam
        return "en"

    # Pre-computed English translations for the non-English seed texts
    _TRANSLATIONS = {
        "हमारे वार्ड में पानी की बहुत कमी है, गर्मियों में पीने का पानी नहीं मिलता।":
            "There is a severe water shortage in our ward, drinking water is not available in summer.",
        "ನಮ್ಮ ಕಾಲೊನಿಯಲ್ಲಿ ರಸ್ತೆ ತುಂಬಾ ಕೆಟ್ಟದಾಗಿದೆ.":
            "The road in our colony is in very bad condition.",
        "बिजली के तार बहुत पुराने हैं, अक्सर शॉर्ट सर्किट होता है।":
            "The electricity wires are very old, short circuits happen frequently.",
        "மருத்துவமனையில் மருந்துகள் கிடைப்பதில்லை.":
            "Medicines are not available at the hospital.",
    }

    for i, s in enumerate(DEMO_SUBMISSIONS_RAW):
        ward_id, text, theme, urgency_level, urgency_score, channel, lat, lng = s
        lang = _detect_lang(text)
        # text_translated = English version; text_raw = always the original submission text
        translated = _TRANSLATIONS.get(text, text) if lang != "en" else text
        sub = Submission(
            id=str(uuid.uuid4()),
            channel=Channel(channel),
            text_raw=text,                 # always the original as submitted
            text_translated=translated,    # English translation (or same if already English)
            lang_detected=lang,
            lat=lat, lng=lng,
            ward_id=ward_id,
            themes=[theme],
            urgency_score=urgency_score,
            urgency_level=UrgencyLevel(urgency_level),
            ai_analysis={"summary": translated[:100]},
            media_urls=[],
            created_at=now - timedelta(days=i),
        )
        db.add(sub)
    await db.flush()

    # Projects
    print("  🏗️  Seeding projects...")
    for p in DEMO_PROJECTS:
        project = Project(
            id=p["id"], ward_id=p["ward_id"], title=p["title"],
            theme=p["theme"],
            priority_rank=p["priority_rank"], priority_score=p["priority_score"],
            demand_score=p["demand_score"], gap_score=p["gap_score"],
            feasibility_score=p["feasibility_score"], urgency_score=p["urgency_score"],
            submission_count=p["submission_count"],
            source=ProjectSource.citizen,
            evidence_text=p["evidence_text"],
        )
        db.add(project)
    await db.flush()

    # Users
    print("  👤 Seeding users...")
    for u in DEMO_USERS:
        user = User(
            id=str(uuid.uuid4()),
            email=u["email"],
            name=u["name"],
            hashed_password=_hash("demo1234"),
            role=UserRole(u["role"]),
            constituency=u["constituency"],
            is_active=True,
        )
        db.add(user)
    await db.flush()

    await db.commit()


async def main():
    print("\n🌱  CivIxa Demo Seeder")
    print("═" * 40)

    engine = create_async_engine(DATABASE_URL, echo=False)

    # Drop and recreate all tables (clean slate)
    print("  🗄️  Creating tables (dropping existing)...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as db:
        await seed(db)

    await engine.dispose()

    print("\n✅  Seeding complete!")
    print("\nDemo accounts:")
    print("  admin@civixa.demo / demo1234  (role: admin)  ← use this to create new users")
    print("  mp@civixa.demo    / demo1234  (role: mp)")
    print("  staff@civixa.demo / demo1234  (role: staff)")
    print("\nStart the API:")
    print("  cd apps/api && uvicorn app.main:app --reload --port 8000")
    print("\nOpen in browser:")
    print("  http://localhost:3000        ← Next.js frontend")
    print("  http://localhost:8000/docs   ← FastAPI Swagger UI")


if __name__ == "__main__":
    asyncio.run(main())
