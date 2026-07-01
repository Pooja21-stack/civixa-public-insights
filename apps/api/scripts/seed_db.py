"""
DB seeder — loads sample wards, submissions, and generates initial priority projects.

Usage:
    cd apps/api
    python -m scripts.seed_db

Requires:
    - DB running (docker-compose up db -d)
    - Alembic migrations applied (alembic upgrade head)
    - .env present with correct DB credentials
"""
from __future__ import annotations
import asyncio
import json
import os
import sys
import uuid

# Allow running from apps/api root
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings
from app.models.ward import Ward
from app.models.submission import Submission, Channel, UrgencyLevel
from app.models.project import Project, ProjectSource
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from app.services.ai.scorer import (
    compute_demand_score, compute_gap_score,
    compute_feasibility_score, compute_priority_score,
)

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# ── Sample data ────────────────────────────────────────────────────────────────

WARDS = [
    {"id": "ward-01", "name": "Ward 1 — Central",  "constituency": "Demo Constituency", "population": 18500, "school_age_population": 3200, "nearest_school_km": 1.2,  "nearest_hospital_km": 2.5},
    {"id": "ward-02", "name": "Ward 2 — North",    "constituency": "Demo Constituency", "population": 22000, "school_age_population": 4100, "nearest_school_km": 2.8,  "nearest_hospital_km": 20.0},
    {"id": "ward-03", "name": "Ward 3 — East",     "constituency": "Demo Constituency", "population": 31000, "school_age_population": 5800, "nearest_school_km": 6.2,  "nearest_hospital_km": 8.5},
    {"id": "ward-04", "name": "Ward 4 — South",    "constituency": "Demo Constituency", "population": 19200, "school_age_population": 3500, "nearest_school_km": 3.1,  "nearest_hospital_km": 4.2},
    {"id": "ward-05", "name": "Ward 5 — West",     "constituency": "Demo Constituency", "population": 24800, "school_age_population": 4600, "nearest_school_km": 2.0,  "nearest_hospital_km": 6.0},
]

SUBMISSIONS_FILE = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "data", "seeds", "sample_submissions.json"
)

PROJECTS = [
    {"id": "proj-001", "title": "New Primary School — Ward 3 East",            "theme": "schools",     "ward_id": "ward-03", "submission_count": 47, "affected_population": 5800,  "source": "combined",  "evidence_text": "47 submissions in Ward 3 cite school access as critical. Ward has 5,800 school-age children but the nearest school is 6.2 km away."},
    {"id": "proj-002", "title": "Primary Health Centre Restoration — Ward 2",  "theme": "health",      "ward_id": "ward-02", "submission_count": 18, "affected_population": 22000, "source": "combined",  "evidence_text": "18 submissions from Ward 2 mention the closed health centre. Residents must travel 20 km for basic care."},
    {"id": "proj-003", "title": "Water Pipeline Extension — Ward 5 West",      "theme": "water",       "ward_id": "ward-05", "submission_count": 33, "affected_population": 12400, "source": "citizen",   "evidence_text": "33 water-related submissions from Ward 5. Residents receive water only 2x per week."},
    {"id": "proj-004", "title": "Road Resurfacing — Ward 3 Village Connector", "theme": "roads",       "ward_id": "ward-03", "submission_count": 38, "affected_population": 8200,  "source": "combined",  "evidence_text": "38 road-related submissions. Road damage forces a 12 km detour."},
    {"id": "proj-005", "title": "Electricity Substation Upgrade — Ward 4",     "theme": "electricity", "ward_id": "ward-04", "submission_count": 29, "affected_population": 19200, "source": "citizen",   "evidence_text": "29 electricity submissions from Ward 4. Substation is running at 140% capacity."},
]

MP_USER = {
    "id":       str(uuid.uuid4()),
    "email":    "mp@demo.civixa.in",
    "name":     "Demo MP",
    "password": "civixa2024",
    "role":     UserRole.mp,
    "constituency": "Demo Constituency",
}


async def seed():
    async with AsyncSessionLocal() as db:
        print("Seeding wards...")
        ward_map: dict[str, dict] = {}
        for w in WARDS:
            ward = Ward(**w)
            db.add(ward)
            ward_map[w["id"]] = w
        await db.flush()

        print("Seeding submissions...")
        if os.path.exists(SUBMISSIONS_FILE):
            with open(SUBMISSIONS_FILE) as f:
                raw_submissions = json.load(f)
            for s in raw_submissions:
                sub = Submission(
                    id              = s.get("id", str(uuid.uuid4())),
                    channel         = Channel(s.get("channel", "web")),
                    text_raw        = s["text_raw"],
                    text_translated = s.get("text_translated"),
                    lang_detected   = s.get("lang", "en"),
                    lat             = s.get("lat"),
                    lng             = s.get("lng"),
                    ward_id         = s.get("ward_id"),
                    themes          = s.get("themes", []),
                    urgency_score   = s.get("urgency_score", 0.5),
                    urgency_level   = UrgencyLevel(s.get("urgency_level", "medium")),
                    ai_analysis     = {},
                    media_urls      = [],
                )
                db.add(sub)
        await db.flush()

        print("Seeding projects with priority scores...")
        # Build ward data map for scorer
        ward_data_map = {w["id"]: w for w in WARDS}

        # Compute global max submission count for demand normalisation
        max_count = max(p["submission_count"] for p in PROJECTS)

        for i, p in enumerate(PROJECTS):
            wd = ward_data_map.get(p["ward_id"], {})
            demand      = compute_demand_score(p["submission_count"], max_count)
            gap         = compute_gap_score(p["theme"], wd)
            feasibility = compute_feasibility_score(
                in_dev_plan=p["source"] in ("combined", "dev_plan"),
                ward_has_boundary=False,
            )
            urgency     = 0.85 if p["theme"] == "health" else 0.78
            priority    = compute_priority_score(demand, gap, feasibility, urgency)

            proj = Project(
                id                 = p["id"],
                title              = p["title"],
                theme              = p["theme"],
                ward_id            = p["ward_id"],
                demand_score       = demand,
                gap_score          = gap,
                feasibility_score  = feasibility,
                urgency_score      = urgency,
                priority_score     = priority,
                priority_rank      = 0,  # assigned after sort
                evidence_text      = p["evidence_text"],
                submission_count   = p["submission_count"],
                affected_population= p["affected_population"],
                source             = ProjectSource(p["source"]),
            )
            db.add(proj)
        await db.flush()

        # Assign ranks
        from sqlalchemy import select
        result = await db.execute(select(Project).order_by(Project.priority_score.desc()))
        all_projects = result.scalars().all()
        for rank, proj in enumerate(all_projects, start=1):
            proj.priority_rank = rank
            print(f"  #{rank} {proj.title} — score={proj.priority_score:.4f}")

        print("Seeding MP user...")
        mp = User(
            id              = MP_USER["id"],
            email           = MP_USER["email"],
            name            = MP_USER["name"],
            hashed_password = get_password_hash(MP_USER["password"]),
            role            = MP_USER["role"],
            constituency    = MP_USER["constituency"],
            is_active       = True,
        )
        db.add(mp)

        await db.commit()
        print(f"\nDone! MP login: {MP_USER['email']} / {MP_USER['password']}")


if __name__ == "__main__":
    asyncio.run(seed())
