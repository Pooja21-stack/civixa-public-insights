import time
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
import app.models  # ensure all models are registered in SQLAlchemy mapper registry
from app.routers import submissions, themes, projects, auth, webhooks, documents, dashboard, wards

logger = logging.getLogger("civixa.access")

# Global rate limiter — keyed by client IP
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(
    title="CivIxa Public Insights API",
    version="0.1.0",
    description="Backend API for the multilingual MP constituency development platform"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every request with method, path, status code and response time."""
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = round((time.perf_counter() - t0) * 1000, 1)
    logger.info(
        "%s %s %s %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        ms,
    )
    return response

app.include_router(auth.router,        prefix="/api/v1/auth",        tags=["auth"])
app.include_router(submissions.router, prefix="/api/v1/submissions",  tags=["submissions"])
app.include_router(themes.router,      prefix="/api/v1/themes",       tags=["themes"])
app.include_router(projects.router,    prefix="/api/v1/projects",     tags=["projects"])
app.include_router(wards.router,       prefix="/api/v1/wards",        tags=["wards"])
app.include_router(webhooks.router,    prefix="/api/v1/webhooks",     tags=["webhooks"])
app.include_router(documents.router,   prefix="/api/v1/documents",    tags=["documents"])
app.include_router(dashboard.router,   prefix="/api/v1/dashboard",    tags=["dashboard"])


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}
