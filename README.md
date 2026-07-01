# CivIxa Public Insights

> **Multilingual AI platform** where citizens submit development suggestions via voice, text, photos, or messaging apps — and MPs get ranked, evidence-backed priority works.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎯 Problem Statement

MPs have no structured way to consolidate citizen feedback, detect recurring needs, and weigh competing development proposals against real demographic and infrastructure data — so high-impact works get missed and low-demand projects get funded.

## ✨ Solution

An AI-powered civic engagement platform that:
- 📝 Accepts submissions in **any language** via web, WhatsApp, or voice
- 🤖 Uses **GPT-4o** to extract themes and score urgency
- 📊 Clusters similar requests to measure demand
- 🗺️ Visualizes demand hotspots on interactive maps
- 🎯 Ranks projects by AI-calculated priority scores
- 📄 Generates evidence-backed reports for MPs

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Citizen Input Layer                       │
│  🌐 Web Form  │  💬 WhatsApp Bot  │  🎙️ Voice Calls        │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Gateway + Auth                     │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      AI Engine Layer                         │
│  GPT-4o · Whisper · LangChain · Clustering · RAG           │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   Data Storage Layer                         │
│  PostgreSQL + PostGIS + pgvector/Pinecone                   │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    MP Dashboard (Next.js)                    │
│  Priority Projects · Heatmaps · Analytics · PDF Reports     │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.11+
- **Docker** & Docker Compose
- **OpenAI API key** (for GPT-4o and Whisper)
- **Mapbox token** (optional, for heatmaps)

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/civixa-public-insights.git
cd civixa-public-insights

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys:
# - OPENAI_API_KEY
# - TWILIO_ACCOUNT_SID (for WhatsApp)
# - NEXT_PUBLIC_MAPBOX_TOKEN (optional)
```

### 2. Start Infrastructure

```bash
git clone <repo>
cd civixa-public-insights
```

### 3. Setup Backend

```bash
cd apps/api

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --port 8000
```

### 4. Start Background Workers

```bash
cd apps/api
celery -A app.workers.celery_app worker --loglevel=info
```

### 5. Setup Frontend

```bash
cd apps/web

# Install dependencies
npm install

# Create local environment file
cp .env.local.example .env.local

# Add your Mapbox token (optional)
echo "NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here" >> .env.local

# Start development server
npm run dev
```

### 6. Access the Application

- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **API Health**: http://localhost:8000/health

## 📱 Features

### For Citizens

- ✅ **Multiple Submission Channels**
  - 🌐 Web form with text, voice recording, and photo upload
  - 💬 WhatsApp bot for messaging
  - 🎙️ Voice call hotline with AI transcription

- ✅ **Multilingual Support**
  - Submit in any language (Hindi, Tamil, Bengali, etc.)
  - Automatic translation to English for AI processing
  - UI available in multiple languages

- ✅ **Anonymous & Secure**
  - No login required for submissions
  - End-to-end encryption
  - Privacy-first design

### For MPs & Officials

- ✅ **AI-Ranked Priority Dashboard**
  - Projects ranked by demand, gap, feasibility, and urgency
  - Evidence cards explaining each ranking
  - Expandable details with score breakdowns

- ✅ **Interactive Demand Heatmap**
  - Visualize submission hotspots by ward
  - Filter by theme and time period
  - Zoom and pan for detailed analysis

- ✅ **Real-time Analytics**
  - Submission statistics and trends
  - Theme distribution charts
  - Ward-wise breakdowns

- ✅ **Export & Reporting**
  - Generate PDF reports for meetings
  - Include charts, maps, and evidence
  - Shareable with stakeholders

## 🎨 Frontend Design

The frontend features a **modern, accessible design** with:

- **Soft Pastel Color Palette**: Pink, blue, green, purple for warmth and trust
- **Glassmorphism Effects**: Backdrop blur and translucent cards
- **Smooth Animations**: Fade, slide, scale transitions throughout
- **Responsive Design**: Mobile-first approach, works on all devices
- **Accessibility**: WCAG AA compliant with proper contrast and focus states

See [`docs/FRONTEND_DESIGN.md`](docs/FRONTEND_DESIGN.md) for complete design system documentation.

## 📊 Priority Scoring Formula

```
Priority Score = (demand × 0.40) + (gap × 0.35) + (feasibility × 0.15) + (urgency × 0.10)
```

**Components:**
- **Demand Weight**: Normalized count of citizen submissions for that theme
- **Gap Score**: Infrastructure gap vs demographic need (e.g., students per km to nearest school)
- **Feasibility Score**: Presence in local development plan + land availability
- **Urgency Score**: Average urgency extracted by GPT from submission language

All components are normalized 0–1 before weighting. Formula is configurable by MP through dashboard.

## 🗂️ Project Structure

```
civixa-public-insights/
│
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/           # Pages (App Router)
│   │   │   ├── components/    # React components
│   │   │   ├── lib/           # Utilities & API clients
│   │   │   └── types/         # TypeScript types
│   │   ├── public/            # Static assets
│   │   └── tailwind.config.ts # Tailwind configuration
│   │
│   └── api/                    # FastAPI backend
│       ├── app/
│       │   ├── routers/       # API endpoints
│       │   ├── services/      # Business logic
│       │   │   ├── ai/        # GPT, Whisper, clustering
│       │   │   └── ingestion/ # PDF, CSV loaders
│       │   ├── models/        # SQLAlchemy ORM
│       │   ├── schemas/       # Pydantic schemas
│       │   └── workers/       # Celery tasks
│       ├── alembic/           # Database migrations
│       └── tests/             # Unit tests
│
├── infra/
│   └── docker-compose.yml     # Infrastructure setup
│
├── data/
│   └── seeds/                 # Sample data
│
└── docs/
    ├── architecture.md        # System architecture
    ├── FRONTEND_DESIGN.md     # Design system
    └── FRONTEND_SETUP.md      # Frontend setup guide
```

## 👥 Team Roles

| Role | Responsibilities |
|------|-----------------|
| **Frontend Developer** | Next.js dashboard, Mapbox integration, responsive design, deployment |
| **Backend Developer** | FastAPI routes, PostgreSQL schema, WhatsApp bot, Celery workers |
| **AI/ML Engineer** | GPT-4o pipeline, Whisper transcription, LangChain RAG, priority scoring |

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Maps**: Mapbox GL JS
- **Charts**: Recharts
- **Forms**: React Hook Form
- **Language**: TypeScript

### Backend
- **Framework**: FastAPI
- **Database**: PostgreSQL + PostGIS
- **Task Queue**: Celery + Redis
- **Messaging**: Twilio (WhatsApp)
- **Language**: Python 3.11

### AI/ML
- **LLM**: OpenAI GPT-4o
- **Speech-to-Text**: Whisper
- **RAG**: LangChain
- **Vector DB**: pgvector / Pinecone
- **Embeddings**: Sentence-Transformers

## 📚 Documentation

- **[Architecture Overview](docs/architecture.md)** - System design and data flow
- **[Frontend Design System](docs/FRONTEND_DESIGN.md)** - UI/UX guidelines and components
- **[Frontend Setup Guide](apps/web/FRONTEND_SETUP.md)** - Detailed frontend installation
- **[API Documentation](http://localhost:8000/docs)** - Interactive API docs (when running)

## 🧪 Testing

### Frontend Tests
```bash
cd apps/web
npm run test
npm run test:e2e
```

### Backend Tests
```bash
cd apps/api
pytest
pytest --cov=app tests/
```

## 🚢 Deployment

### Frontend (Vercel)
```bash
cd apps/web
vercel --prod
```

### Backend (Render/Railway)
```bash
cd apps/api
# Follow platform-specific deployment guide
```

### Docker (Full Stack)
```bash
docker-compose up --build
```

## 🔐 Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
```

### Backend (.env)
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/civixa
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT-4o and Whisper APIs
- Mapbox for mapping infrastructure
- Next.js and FastAPI communities
- All contributors and testers

## 📞 Support

For questions or issues:
- Open an issue on GitHub
- Email: support@civixa.org
- Documentation: [docs/](docs/)

---

**Built with ❤️ for better civic engagement**
