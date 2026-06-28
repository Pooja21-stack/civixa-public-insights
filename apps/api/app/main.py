from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import submissions, themes, projects, auth, webhooks

app = FastAPI(
    title="CivIxa Public Insights API",
    version="0.1.0",
    description="Backend API for the multilingual MP constituency development platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(submissions.router, prefix="/api/v1/submissions", tags=["submissions"])
app.include_router(themes.router, prefix="/api/v1/themes", tags=["themes"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["webhooks"])


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}
