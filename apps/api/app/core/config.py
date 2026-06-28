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

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_EMBED_MODEL: str = "text-embedding-3-small"
    WHISPER_MODEL: str = "whisper-1"

    # RAG / Vector store
    CHUNK_SIZE: int = 500          # tokens per chunk
    CHUNK_OVERLAP: int = 50        # overlap between chunks
    RAG_TOP_K: int = 5             # number of chunks to retrieve per query
    VECTOR_STORE: str = "pgvector" # "pgvector" or "pinecone"

    # Clustering
    CLUSTER_MIN_SAMPLES: int = 3   # min submissions to form a cluster
    EMBED_BATCH_SIZE: int = 32     # batch size for sentence-transformer inference

    # Twilio (WhatsApp)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    # AWS S3 (file storage — optional, falls back to local)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_REGION: str = "ap-south-1"

    # Mapbox
    MAPBOX_TOKEN: str = ""

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "https://civixa.vercel.app"]


settings = Settings()
