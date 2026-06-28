from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.process_submission", bind=True, max_retries=3)
def process_submission(self, submission_id: str):
    """
    Async pipeline:
      1. Detect language
      2. Translate to English
      3. Extract themes via GPT-4o
      4. Score urgency
      5. Update submission record
      6. Trigger priority re-ranking for affected ward
    Full implementation in AI pipeline step.
    """
    pass


@celery_app.task(name="app.workers.tasks.ingest_document", bind=True, max_retries=3)
def ingest_document(self, document_id: str):
    """
    1. Extract text from PDF/CSV
    2. Chunk and embed
    3. Store in pgvector
    Full implementation in RAG step.
    """
    pass
