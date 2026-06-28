from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "civixa",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.workers.tasks.process_submission": {"queue": "submissions"},
        "app.workers.tasks.ingest_document": {"queue": "ingestion"}
    }
)
