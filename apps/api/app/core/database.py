from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

_url = settings.DATABASE_URL

# SQLite doesn't support pool_size / max_overflow
_is_sqlite = _url.startswith("sqlite")
engine = create_async_engine(
    _url,
    echo=settings.DEBUG,
    **({"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20} if not _is_sqlite else {}),
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
