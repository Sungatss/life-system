import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("uvicorn.error")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./lifesystem.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
engine_kwargs = {
    "pool_pre_ping": True,
}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # Cloud PostgreSQL optimizations for serverless & pooled connections
    engine_kwargs.update({
        "pool_recycle": 300,
        "pool_size": 5,
        "max_overflow": 10,
    })


def init_engine(url: str):
    try:
        return create_engine(url, connect_args=connect_args, **engine_kwargs)
    except Exception as e:
        # If standard postgresql:// (psycopg2) fails on serverless environments, fallback to pure-python pg8000
        if url.startswith("postgresql://"):
            logger.warning(f"Standard PostgreSQL driver failed ({e}), attempting pg8000 driver...")
            pg8000_url = url.replace("postgresql://", "postgresql+pg8000://", 1)
            return create_engine(pg8000_url, connect_args=connect_args, **engine_kwargs)
        raise


engine = init_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
