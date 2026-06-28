# Architecture Overview

## System Layers

### 1. Citizen Input Layer
- **Web PWA** — text, photo, optional GPS location
- **WhatsApp Bot** — Twilio webhook, handles text and voice messages
- **Voice** — audio file upload → Whisper transcription

### 2. API Gateway (FastAPI)
- JWT authentication for MP dashboard
- Multipart form handling for media uploads
- Webhook endpoint for Twilio

### 3. AI Engine
| Component | Tool | Purpose |
|-----------|------|---------|
| Language Detection | langdetect | Detect submission language |
| Translation | deep-translator (Google) | Normalise to English |
| Transcription | OpenAI Whisper | Voice → text |
| Theme Extraction | GPT-4o | Classify into theme taxonomy |
| Urgency Scoring | GPT-4o | Score 0–1, label low/medium/high/critical |
| Clustering | Sentence-Transformers + K-means | Group similar submissions |
| RAG | LangChain + pgvector | Query dev plans, census data |

### 4. Data Layer
- **PostgreSQL + PostGIS** — submissions, projects, wards with geo support
- **pgvector** — semantic embeddings for RAG
- **Redis** — Celery task broker and result backend

### 5. MP Dashboard (Next.js)
- Priority project cards with evidence
- Mapbox heatmap of submission density
- Recharts for theme/ward analytics
- PDF export of ranked recommendations

## Priority Scoring Formula
```
Priority Score = (demand × 0.40) + (gap × 0.35) + (feasibility × 0.15) + (urgency × 0.10)
```

### Component Definitions
- **demand_score** — normalised submission count for theme in ward
- **gap_score** — infrastructure gap vs demographic need (e.g. students per km to school)
- **feasibility_score** — presence in dev plan + land availability proxy
- **urgency_score** — avg urgency from GPT analysis of submission text

## Data Flow

```
1. Citizen submits via web/WhatsApp/voice
2. FastAPI receives, stores raw submission, fires Celery task
3. Celery worker: detect lang → translate → GPT theme extraction
4. Update submission with themes + urgency scores
5. Re-compute demand aggregates for affected ward
6. Re-rank projects: update priority_score + priority_rank
7. MP dashboard reflects updated ranking in real-time
```
