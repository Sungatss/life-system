"""Isolated checks for hosted database startup and shared request limits."""

import asyncio
import ssl
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session

from backend.app import auth, main, models
from backend.app.database import Base, prepare_database_url


class CloudStartupTests(unittest.TestCase):
    def test_cloud_database_keeps_certificate_verification(self):
        url, args, _ = prepare_database_url("postgresql://user:password@db.example/test?sslmode=require")
        self.assertTrue(url.startswith("postgresql+pg8000://"))
        context = args["ssl_context"]
        self.assertTrue(context.check_hostname)
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)

    def test_vercel_refuses_temporary_sqlite_storage(self):
        with patch.dict("os.environ", {"VERCEL": "1"}):
            for url in ("", "sqlite:////tmp/lifesystem.db"):
                with self.assertRaisesRegex(RuntimeError, "persistent PostgreSQL"):
                    prepare_database_url(url)

    def test_startup_is_repeatable_with_one_transaction(self):
        engine = create_engine("sqlite:///:memory:")
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE daily_notes (id INTEGER PRIMARY KEY, content TEXT)"))
        original_engine, original_error = main.engine, main.db_startup_error

        async def start_twice():
            for _ in range(2):
                async with main.lifespan(main.app):
                    self.assertIsNone(main.db_startup_error)

        try:
            main.engine = engine
            asyncio.run(start_twice())
            with Session(engine) as db:
                self.assertEqual(db.scalar(select(func.count()).select_from(models.Task)), 3)
                self.assertEqual(db.scalar(select(func.count()).select_from(models.Habit)), 5)
                self.assertEqual(db.scalar(select(func.count()).select_from(models.RateWindow)), 0)
            with engine.connect() as connection:
                self.assertFalse(connection.dialect.has_table(connection, "daily_notes"))
        finally:
            main.engine, main.db_startup_error = original_engine, original_error
            engine.dispose()

    def test_serverless_limits_are_shared_between_sessions(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        try:
            with patch.dict("os.environ", {"VERCEL": "1"}), patch("backend.app.auth.time.time", return_value=1_700_000_100):
                for _ in range(3):
                    with Session(engine) as db:
                        auth.assistant_limit(db)
                with Session(engine) as db:
                    with self.assertRaises(HTTPException) as error:
                        auth.assistant_limit(db)
                    self.assertEqual(error.exception.status_code, 429)
                for _ in range(5):
                    with Session(engine) as db:
                        auth.login_limit("example-ip", db)
                with Session(engine) as db:
                    with self.assertRaises(HTTPException) as error:
                        auth.login_limit("example-ip", db)
                    self.assertEqual(error.exception.status_code, 429)
                    auth.clear_login_limit("example-ip", db)
                    auth.login_limit("example-ip", db)
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
