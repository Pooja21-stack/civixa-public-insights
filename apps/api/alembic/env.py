import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool, create_engine
from alembic import context
from app.models.base import Base
from dotenv import load_dotenv

load_dotenv()

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# ── Resolve DB URL ─────────────────────────────────────────────────────────────
# Priority: SQLITE_URL env var → individual PG vars → alembic.ini default
_sqlite_url = os.environ.get("SQLITE_URL", "")
if _sqlite_url:
    # Strip the +aiosqlite driver — alembic uses the sync driver
    _sync_url = _sqlite_url.replace("+aiosqlite", "")
    config.set_main_option("sqlalchemy.url", _sync_url)
else:
    config.set_section_option("alembic", "DB_USER", os.environ.get("DB_USER", "civixa"))
    config.set_section_option("alembic", "DB_PASS", os.environ.get("DB_PASS", "civixa"))
    config.set_section_option("alembic", "DB_HOST", os.environ.get("DB_HOST", "localhost"))
    config.set_section_option("alembic", "DB_NAME", os.environ.get("DB_NAME", "civixa_db"))


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True,
                      render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata,
                          render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
