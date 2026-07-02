"""
DB seeder — loads sample wards, submissions, and generates initial priority projects.

Usage:
    cd apps/api
    python -m scripts.seed_db

Safe to run multiple times — uses merge (upsert) so existing rows are updated,
not duplicated. Also re-creates demo.db from scratch if --reset flag is passed:

    python -m scripts.seed_db --reset

Requires:
    - Alembic migrations applied (alembic upgrade head)
    - .env present (SQLITE_URL or DB_* vars)
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
from sqlalchemy import select
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

MP_EMAIL    = "mp@demo.civixa.in"
MP_PASSWORD = "civixa2024"


async def _upsert(db, model_class, pk_field: str, pk_value, **kwargs):
    """Fetch existing row by PK; update if found, insert if not."""
    result = await db.execute(
        select(model_class).where(getattr(model_class, pk_field) == pk_value)
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        obj = model_class(**{pk_field: pk_value}, **kwargs)
        db.add(obj)
        return obj, "inserted"
    for k, v in kwargs.items():
        setattr(obj, k, v)
    return obj, "updated"


async def seed():
    async with AsyncSessionLocal() as db:

        # ── Wards ──────────────────────────────────────────────────────────────
        print("Seeding wards...")
        for w in WARDS:
            wid = w["id"]
            _, action = await _upsert(db, Ward, "id", wid,
                name=w["name"],
                constituency=w["constituency"],
                population=w["population"],
                school_age_population=w["school_age_population"],
                nearest_school_km=w["nearest_school_km"],
                nearest_hospital_km=w["nearest_hospital_km"],
            )
            print(f"  ward {wid}: {action}")
        await db.flush()

        # ── Submissions ────────────────────────────────────────────────────────
        print("Seeding submissions...")
        if os.path.exists(SUBMISSIONS_FILE):
            with open(SUBMISSIONS_FILE) as f:
                raw_submissions = json.load(f)
            for s in raw_submissions:
                sid = s.get("id", str(uuid.uuid4()))
                _, action = await _upsert(db, Submission, "id", sid,
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
            print(f"  {len(raw_submissions)} submissions seeded")
        else:
            print(f"  WARNING: submissions file not found at {SUBMISSIONS_FILE}")
        await db.flush()

        # ── Projects ───────────────────────────────────────────────────────────
        print("Seeding projects with priority scores...")
        ward_data_map = {w["id"]: w for w in WARDS}
        max_count = max(p["submission_count"] for p in PROJECTS)

        for p in PROJECTS:
            wd          = ward_data_map.get(p["ward_id"], {})
            demand      = compute_demand_score(p["submission_count"], max_count)
            gap         = compute_gap_score(p["theme"], wd)
            feasibility = compute_feasibility_score(
                in_dev_plan=p["source"] in ("combined", "dev_plan"),
                ward_has_boundary=False,
            )
            urgency  = 0.85 if p["theme"] == "health" else 0.78
            priority = compute_priority_score(demand, gap, feasibility, urgency)

            await _upsert(db, Project, "id", p["id"],
                title               = p["title"],
                theme               = p["theme"],
                ward_id             = p["ward_id"],
                demand_score        = demand,
                gap_score           = gap,
                feasibility_score   = feasibility,
                urgency_score       = urgency,
                priority_score      = priority,
                priority_rank       = 0,
                evidence_text       = p["evidence_text"],
                submission_count    = p["submission_count"],
                affected_population = p["affected_population"],
                source              = ProjectSource(p["source"]),
            )
        await db.flush()

        # Assign global ranks
        result = await db.execute(select(Project).order_by(Project.priority_score.desc()))
        all_projects = result.scalars().all()
        for rank, proj in enumerate(all_projects, start=1):
            proj.priority_rank = rank
            print(f"  #{rank} {proj.title} — score={proj.priority_score:.4f}")

        # ── MP user ────────────────────────────────────────────────────────────
        print("Seeding MP user...")
        result = await db.execute(select(User).where(User.email == MP_EMAIL))
        mp = result.scalar_one_or_none()
        if mp is None:
            mp = User(
                id              = str(uuid.uuid4()),
                email           = MP_EMAIL,
                name            = "Demo MP",
                hashed_password = get_password_hash(MP_PASSWORD),
                role            = UserRole.mp,
                constituency    = "Demo Constituency",
                is_active       = True,
            )
            db.add(mp)
            print("  MP user created")
        else:
            print("  MP user already exists — skipped")

        await db.commit()
        print(f"\nDone! MP login: {MP_EMAIL} / {MP_PASSWORD}")


if __name__ == "__main__":
    # Optional --reset flag: delete and recreate demo.db before seeding
    if "--reset" in sys.argv:
        db_url = settings.DATABASE_URL
        if "sqlite" in db_url:
            db_path = db_url.split("///")[-1]
            if os.path.exists(db_path):
                os.remove(db_path)
                print(f"Deleted {db_path}")
        # Re-run alembic upgrade head
        import subprocess
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)

    asyncio.run(seed())
