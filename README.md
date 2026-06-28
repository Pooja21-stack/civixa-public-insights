# CivIxa — Public Insights

> Multilingual AI platform where citizens submit development suggestions via voice, text, photos, or messaging apps — and MPs get ranked, evidence-backed priority works.

## Architecture

```
Citizen Input (Web / WhatsApp / Voice)
         ↓
   FastAPI Gateway
         ↓
   AI Engine (GPT-4o + Whisper + LangChain)
         ↓
   PostgreSQL + PostGIS + pgvector
         ↓
   MP Dashboard (Next.js + Mapbox)
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.11+
- OpenAI API key

### 1. Clone & configure
```bash
cp .env.example .env
# Fill in OPENAI_API_KEY and other required keys
```

### 2. Start infrastructure
```bash
cd infra
docker-compose up db redis -d
```

### 3. Run database migrations
```bash
cd apps/api
pip install -r requirements.txt
alembic upgrade head
```

### 4. Start the API
```bash
uvicorn app.main:app --reload
```

### 5. Start the worker
```bash
celery -A app.workers.celery_app worker --loglevel=info
```

### 6. Start the web app
```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Team

| Role | Responsibilities |
|------|-----------------|
| Member A | Next.js frontend, Mapbox maps, Docker, deployment |
| Member B | FastAPI backend, PostgreSQL schema, WhatsApp bot, Celery |
| Member C | GPT-4o AI pipeline, Whisper, LangChain RAG, priority scoring |

## Project Structure

```
civixa-public-insights/
├── apps/
│   ├── web/               ← Next.js (citizen form + MP dashboard)
│   └── api/               ← FastAPI backend
│       ├── routers/
│       ├── services/
│       │   ├── ai/        ← GPT, Whisper, clustering
│       │   └── ingestion/ ← PDF, CSV loaders
│       ├── models/        ← SQLAlchemy ORM models
│       ├── schemas/       ← Pydantic request/response schemas
│       └── workers/       ← Celery async tasks
├── infra/
│   └── docker-compose.yml
├── data/
│   └── seeds/
└── docs/
```

## Priority Scoring Formula

```
Priority Score = demand × 0.40 + gap × 0.35 + feasibility × 0.15 + urgency × 0.10
```

All components normalised 0–1 before weighting.

## License
MIT
