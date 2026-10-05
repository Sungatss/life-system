import os
import ssl
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("uvicorn.error")

RAW_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


def prepare_database_url(raw_url: str):
    connect_args = {}
    engine_kwargs = {
        "pool_pre_ping": True,
    }

    if not raw_url:
        # Default local sqlite fallback (use /tmp if current dir is read-only)
        if not os.access(".", os.W_OK):
            url = "sqlite:////tmp/lifesystem.db"
        else:
            url = "sqlite:///./lifesystem.db"
        connect_args["check_same_thread"] = False
        return url, connect_args, engine_kwargs

    url = raw_url

    if url.startswith("sqlite"):
        if not os.access(".", os.W_OK) and not url.startswith("sqlite:////tmp"):
            url = "sqlite:////tmp/lifesystem.db"
        connect_args["check_same_thread"] = False
        return url, connect_args, engine_kwargs

    # PostgreSQL handling
    # Convert postgres:// and postgresql:// to postgresql+pg8000:// (pure-Python driver, 100% reliable on Vercel)
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+pg8000://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = url.replace("postgresql://", "postgresql+pg8000://", 1)

    # Serverless pooling & keepalive
    engine_kwargs.update({
        "pool_recycle": 300,
        "pool_size": 5,
        "max_overflow": 10,
    })

    if "pg8000" in url:
        # Ensure SSL context works with cloud Neon / Supabase certificates
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl_context"] = ctx

    return url, connect_args, engine_kwargs


DATABASE_URL, connect_args, engine_kwargs = prepare_database_url(RAW_DATABASE_URL)
engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
