from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "CivIxa Public Insights"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h

    # Database
    DB_USER: str = "civixa"
    DB_PASS: str = "civixa"
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "civixa_db"

    # Optional SQLite override — set this to use SQLite instead of Postgres
    # e.g.  SQLITE_URL=sqlite+aiosqlite:///./demo.db
    SQLITE_URL: str = ""

    @property
    def DATABASE_URL(self) -> str:
        if self.SQLITE_URL:
            return self.SQLITE_URL
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        if self.SQLITE_URL:
            return self.SQLITE_URL.replace("+aiosqlite", "")
        return f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Ollama (local LLM — free, no API key needed) ──────────────────────────
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "mistral"          # mistral | llama3 | any pulled model
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"   # local embeddings (optional)
    OLLAMA_TIMEOUT: int = 120              # seconds per request

    # ── Whisper.cpp (local transcription — free) ──────────────────────────────
    WHISPER_CPP_MODEL: str = "base"       # tiny | base | small | medium
    WHISPER_CPP_PATH: str = ""            # path to whisper.cpp binary (optional)

    # RAG / Vector store
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    RAG_TOP_K: int = 5
    VECTOR_STORE: str = "pgvector"

    # Clustering
    CLUSTER_MIN_SAMPLES: int = 3
    EMBED_BATCH_SIZE: int = 32

    # Twilio (WhatsApp)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    # AWS S3 (optional)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_REGION: str = "ap-south-1"

    # Mapbox
    MAPBOX_TOKEN: str = ""

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "https://civixa.vercel.app"]


settings = Settings()
