# CivIxa Public Insights

> **Multilingual AI platform for MP constituency development planning**
>
> Citizens submit development needs via web, WhatsApp, or voice in any Indian language.
> AI surfaces recurring themes, maps demand hotspots, and recommends priority development
> works an MP can act on — backed by demographic data, infrastructure gap analysis, and
> local development plan documents.

---

## Table of Contents

1. [What We Are Building](#what-we-are-building)
2. [System Architecture](#system-architecture)
3. [AI Pipeline](#ai-pipeline)
4. [Priority Scoring Formula](#priority-scoring-formula)
5. [Roles & Access Control](#roles--access-control)
6. [API Reference](#api-reference)
7. [Quick Start — Local Dev](#quick-start--local-dev)
8. [Project Structure](#project-structure)
9. [Environment Variables](#environment-variables)
10. [Team](#team)

---

## What We Are Building

### The Problem

MPs receive development requests through public meetings, letters, social media, grievance portals,
and direct representations — while local development plans contain dozens of competing proposed
projects. There is no objective way to:

- Consolidate citizen feedback across channels
- Spot recurring needs (e.g. 47 people in Ward 3 citing school access)
- Weigh competing proposals against real demographic data
- Produce evidence-backed recommendations an MP can act on

### Our Solution

**CivIxa Public Insights** is a multilingual AI platform with three layers:

```
CITIZEN LAYER          AI LAYER               MP LAYER
─────────────         ──────────             ──────────
Web form        →                      →   Priority dashboard
WhatsApp bot    →   Transcribe          →   Theme heatmap
Voice upload    →   Translate (10 lang) →   Evidence cards
Photo upload    →   Theme extraction    →   RAG search on
                    Urgency scoring         dev plan PDFs
                    Clustering
                    Priority ranking
```

### Key Features

| Feature | Details |
|---|---|
| **Multilingual submissions** | Web form, WhatsApp (Twilio), voice upload — 10 Indian languages |
| **AI Theme Extraction** | Ollama/Mistral classifies into: roads, schools, water, health, electricity, other |
| **Priority Scoring** | `demand×0.40 + gap×0.35 + feasibility×0.15 + urgency×0.10` |
| **Demand Hotspot Map** | GeoJSON heatmap of geo-tagged submissions (Mapbox) |
| **RAG Document Search** | Upload PDF dev plans → semantic search via sentence-transformers |
| **MP Dashboard** | Priority projects, theme charts, urgency breakdown, evidence cards |
| **RBAC Auth** | JWT Bearer tokens with 3 roles: admin / mp / staff |

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        CITIZEN INPUT                           │
│  Web Form ──┐                                                  │
│  WhatsApp ──┼──▶  POST /api/v1/submissions  ──▶  SQLite/PG    │
│  Voice    ──┘         (public endpoint)          demo.db       │
└────────────────────────────────────────────────────────────────┘
                              │
                    Celery async task
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                        AI PIPELINE                             │
│  1. Transcribe (faster-whisper, local)                        │
│  2. Detect language + Translate (langdetect + deep-translator) │
│  3. Extract themes + urgency (Ollama/Mistral, local)          │
│  4. Score priority (demand + gap + feasibility + urgency)      │
│  5. Cluster submissions (DBSCAN + sentence-transformers)       │
│  6. Generate evidence cards (Ollama/Mistral)                   │
│  7. Ingest dev-plan PDFs → pgvector / in-memory RAG           │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                        MP DASHBOARD                            │
│  Next.js 14 ──▶  /dashboard                                   │
│  Priority Works list + bar chart + heatmap + submissions feed  │
└────────────────────────────────────────────────────────────────┘
```

**Technology stack:**

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts, Mapbox |
| Backend | FastAPI (Python 3.9), SQLAlchemy async, Alembic |
| AI/ML | Ollama (Mistral), sentence-transformers, faster-whisper, DBSCAN |
| Database | SQLite (local dev) / PostgreSQL + pgvector (production) |
| Queue | Celery + Redis |
| Auth | JWT (HS256), bcrypt, role-based access control |

---

## AI Pipeline

```
Citizen Message (any language)
        │
        ▼
┌── Transcriber ──────────────────────────────────────────────┐
│  faster-whisper (local, CPU) → openai-whisper → text fallback│
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌── Translator ───────────────────────────────────────────────┐
│  langdetect → detect language code (hi, gu, ta, kn, ...)    │
│  deep-translator (Google free) → English translation         │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌── Theme Extractor (Ollama/Mistral) ─────────────────────────┐
│  Prompt: classify into themes[], urgency_score, summary      │
│  Output: {"themes":["schools","roads"],"urgency_score":0.88} │
│  Fallback: keyword matching if Ollama unavailable            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌── Priority Scorer ──────────────────────────────────────────┐
│  demand      = normalised submission count (weight: 40%)     │
│  gap         = sigmoid(distance to facility) (weight: 35%)   │
│  feasibility = dev-plan mention + ward boundary (weight: 15%)│
│  urgency     = avg urgency score from Ollama (weight: 10%)   │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌── Clustering (DBSCAN) ──────────────────────────────────────┐
│  sentence-transformers embeddings → DBSCAN clusters          │
│  Groups related submissions, identifies dominant themes      │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌── Evidence Generator (Ollama/Mistral) ──────────────────────┐
│  Generates human-readable MP briefing card per project       │
│  Uses ward demographics + RAG context from dev plan PDFs     │
└─────────────────────────────────────────────────────────────┘
```

**All AI runs 100% locally via Ollama — no internet, no API key, no cost.**

---

## Priority Scoring Formula

```
Priority Score = (demand × 0.40) + (gap × 0.35) + (feasibility × 0.15) + (urgency × 0.10)
```

| Component | Meaning | How calculated |
|---|---|---|
| **demand** (40%) | How many citizens need this | Normalised submission count vs. ward max |
| **gap** (35%) | How far away is the nearest facility | Sigmoid on km distance (schools, health) |
| **feasibility** (15%) | How easy to implement | Dev plan mention (+0.4), ward boundary (+0.3) |
| **urgency** (10%) | How critical is the need | Average Ollama urgency score (0–1) |

All components are normalised to 0–1 before weighting.

---

## Roles & Access Control

The platform has three roles. Access is enforced via **JWT Bearer tokens** on every protected endpoint.

### Role Definitions

| Role | Who | Access Level |
|---|---|---|
| `admin` | System administrator | Full access — user management, all data, all settings |
| `mp` | The Member of Parliament | Dashboard, submissions, projects, wards, documents |
| `staff` | MP's office staff | Dashboard, submissions, projects, wards, documents (read + upload) |

### RBAC Matrix

| Endpoint | Public (no login) | Staff | MP | Admin |
|---|:---:|:---:|:---:|:---:|
| `POST /submissions` | ✅ | ✅ | ✅ | ✅ |
| `POST /webhooks/whatsapp` | ✅ | — | — | — |
| `POST /auth/login` | ✅ | — | — | — |
| `GET /submissions` | — | ✅ | ✅ | ✅ |
| `GET /submissions/{id}` | — | ✅ | ✅ | ✅ |
| `GET /submissions/hotspots` | — | ✅ | ✅ | ✅ |
| `GET /projects/priority` | — | ✅ | ✅ | ✅ |
| `GET /projects/{id}` | — | ✅ | ✅ | ✅ |
| `GET /dashboard/stats` | — | ✅ | ✅ | ✅ |
| `GET /wards` | — | ✅ | ✅ | ✅ |
| `GET /wards/{id}` | — | ✅ | ✅ | ✅ |
| `POST /wards` | — | — | ✅ | ✅ |
| `PUT /wards/{id}` | — | — | ✅ | ✅ |
| `POST /documents/upload` | — | ✅ | ✅ | ✅ |
| `GET /documents/` | — | ✅ | ✅ | ✅ |
| `POST /documents/{id}/query` | — | ✅ | ✅ | ✅ |
| `GET /auth/me` | — | ✅ | ✅ | ✅ |
| `POST /auth/change-password` | — | ✅ | ✅ | ✅ |
| `POST /auth/register` | — | — | — | ✅ |
| `GET /auth/users` | — | — | — | ✅ |
| `PATCH /auth/users/{id}` | — | — | — | ✅ |
| `DELETE /auth/users/{id}` | — | — | — | ✅ |

### How to authenticate

```bash
# 1. Login — get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mp@civixa.demo","password":"demo1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Use token on protected endpoints
curl http://localhost:8000/api/v1/dashboard/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

## API Reference

### Auth (`/api/v1/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/login` | Public | Get JWT token |
| POST | `/register` | Admin | Create new user account |
| GET | `/me` | Any role | Get own profile |
| POST | `/change-password` | Any role | Change own password |
| GET | `/users` | Admin | List all users |
| GET | `/users/{id}` | Admin | Get user by ID |
| PATCH | `/users/{id}` | Admin | Update user (name, role, active) |
| DELETE | `/users/{id}` | Admin | Deactivate user account |

### Submissions (`/api/v1/submissions`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `` | Public | Submit a development request |
| GET | `` | Staff+ | List submissions (paginated, filterable) |
| GET | `/{id}` | Staff+ | Get submission by ID |
| GET | `/hotspots` | Staff+ | GeoJSON heatmap data |

### Projects (`/api/v1/projects`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/priority` | Staff+ | Priority-ranked projects list |
| GET | `/{id}` | Staff+ | Project detail with evidence |

### Wards (`/api/v1/wards`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `` | Staff+ | All wards with submission counts |
| GET | `/{id}` | Staff+ | Ward detail + submissions + projects |
| POST | `` | MP+ | Create new ward |
| PUT | `/{id}` | MP+ | Update ward demographics |

### Dashboard (`/api/v1/dashboard`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats` | Staff+ | Total submissions, themes, urgency, top projects |

### Documents / RAG (`/api/v1/documents`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/upload` | Staff+ | Upload PDF/CSV development plan |
| GET | `/` | Staff+ | List ingested documents |
| POST | `/{id}/query` | Staff+ | Semantic search against documents |

### Webhooks (`/api/v1/webhooks`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/whatsapp` | Public (Twilio HMAC) | Inbound WhatsApp message |
| GET | `/whatsapp/health` | Public | Twilio config health check |

---

## Quick Start — Local Dev

### Prerequisites

- Python 3.9+
- Node.js 18+
- [Ollama](https://ollama.ai) installed

### 1. Clone and setup

```bash
git clone <repo>
cd civixa-public-insights
```

### 2. Backend

```bash
cd apps/api

# Create and activate venv
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed demo database (SQLite, no Postgres needed)
python scripts/seed_demo.py

# Start the API
uvicorn app.main:app --reload --port 8000
```

Open **http://localhost:8000/docs** — full Swagger UI.

**Demo accounts:**

| Email | Password | Role | Can do |
|---|---|---|---|
| `admin@civixa.demo` | `demo1234` | admin | Create users, all access |
| `mp@civixa.demo` | `demo1234` | mp | Dashboard, wards, projects |
| `staff@civixa.demo` | `demo1234` | staff | Dashboard, submissions |

### 3. AI (Ollama)

```bash
# In a separate terminal
ollama serve
ollama pull mistral   # ~4.4 GB, one-time download

# Test the AI pipeline
cd apps/api && source .venv/bin/activate
python scripts/test_live_ai.py
```

### 4. Frontend

```bash
cd apps/web
cp .env.local.example .env.local
npm install
npm run dev
```

Open **http://localhost:3000**

**Toggle mock vs real API** in `apps/web/.env.local`:
```bash
NEXT_PUBLIC_USE_MOCK_API=false   # use real backend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 5. Full stack with Docker

```bash
docker compose -f infra/docker-compose.yml up --build
cd apps/api && USE_POSTGRES=1 python scripts/seed_demo.py
```

---

## Project Structure

```
civixa-public-insights/
│
├── apps/
│   ├── web/                          ← Next.js 14 frontend (Member A)
│   │   ├── src/app/                  ← Pages: home, submit, dashboard, project detail
│   │   ├── src/components/           ← UI components (DashboardStatsPanel, SubmissionsFeed, etc.)
│   │   ├── src/lib/                  ← api-mock.ts, flags.ts (USE_MOCK_API), constants.ts
│   │   └── src/types/index.ts        ← TypeScript types
│   │
│   └── api/                          ← FastAPI backend (Members B + C)
│       ├── app/
│       │   ├── main.py               ← FastAPI app + CORS + rate limiting + logging
│       │   ├── core/
│       │   │   ├── config.py         ← Settings (Ollama, DB, JWT, Twilio, etc.)
│       │   │   ├── database.py       ← Async SQLAlchemy (SQLite + PostgreSQL)
│       │   │   ├── security.py       ← bcrypt + JWT
│       │   │   └── auth_deps.py      ← get_current_user(), require_role()
│       │   ├── models/               ← SQLAlchemy ORM: ward, submission, project, user, document
│       │   ├── schemas/              ← Pydantic v2: submission, project, ward, auth, document
│       │   ├── routers/              ← API endpoints: auth, submissions, projects, wards,
│       │   │                             dashboard, documents, webhooks
│       │   ├── services/
│       │   │   ├── ai/               ← Ollama theme extraction, scorer, RAG, clustering,
│       │   │   │                         evidence generator, transcriber, translator
│       │   │   ├── ingestion/        ← PDF loader (PyMuPDF)
│       │   │   └── submission_service.py ← CRUD + rerank
│       │   └── workers/              ← Celery tasks: process_submission, ingest_document
│       ├── alembic/versions/         ← DB migrations (0001: initial, 0002: document_chunks)
│       ├── scripts/
│       │   ├── seed_demo.py          ← Demo data seeder (SQLite/Postgres)
│       │   ├── test_local.py         ← Offline AI pipeline demo
│       │   └── test_live_ai.py       ← Live Ollama demo
│       └── tests/                    ← 62 tests (pytest)
│
├── infra/
│   └── docker-compose.yml            ← PostgreSQL + pgvector + Redis + API + Web
│
└── data/seeds/                       ← sample_submissions.json, sample_wards.json
```

---

## Environment Variables

### Backend (`apps/api/.env`)

```bash
# App
SECRET_KEY=change-me-in-production
DEBUG=false

# Database — SQLite (local dev, no Docker needed)
SQLITE_URL=sqlite+aiosqlite:///./demo.db

# Database — PostgreSQL (production / Docker)
# DB_USER=civixa
# DB_PASS=civixa
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=civixa_db

# Redis (required for Celery async AI tasks)
REDIS_URL=redis://localhost:6379/0

# Ollama (local LLM — free, no API key needed)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
OLLAMA_TIMEOUT=120

# Whisper (local speech-to-text, CPU only)
WHISPER_CPP_MODEL=base

# Twilio WhatsApp (leave blank for local testing)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Mapbox (optional — for heatmap)
MAPBOX_TOKEN=
```

### Frontend (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_USE_MOCK_API=true        # set false to use real backend
NEXT_PUBLIC_MAPBOX_TOKEN=            # optional
```

---

## Running Tests

```bash
cd apps/api
source .venv/bin/activate
python -m pytest tests/ -v
```

**62 tests, 0 failures.**

| Test file | Coverage |
|---|---|
| `test_health.py` (2) | Health endpoint, app startup |
| `test_ai_pipeline.py` (25) | Theme extraction, urgency scoring, translation, transcription, normalisation |
| `test_rag_evidence_clustering.py` (35) | RAG chunking/embedding/query, evidence generation, DBSCAN clustering |

---

## Team

| Member | Role | Stack |
|---|---|---|
| **Member A** | Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts, Mapbox |
| **Member B** | Backend | FastAPI, SQLAlchemy, Alembic, Celery, PostgreSQL |
| **Member C** | AI / ML | Ollama (Mistral), sentence-transformers, DBSCAN, faster-whisper, RAG |

---

## License

MIT
