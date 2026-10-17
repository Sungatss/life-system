"""Offline assistant tests use a fresh database and fake Groq output."""

import datetime as dt
import json
import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from backend.app import assistant, auth, models
from backend.app.database import Base


def action(kind, target=None, title=None, project=None):
    return assistant.ModelAction(type=kind, target_id=target, title=title, description=None,
                                 due_date=None, priority=None, project_id=project)


class AssistantTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        with Session(self.engine) as db:
            project = models.Project(name="Portfolio", plan="Ship a homepage")
            db.add(project)
            db.flush()
            task = models.Task(title="Write portfolio copy", description="Intro", priority="high", project_id=project.id)
            db.add_all([task, models.Task(title="Clean kitchen", description="Counters"),
                        models.Habit(name="Read 20 minutes"), models.InboxEntry(content="Portfolio hero idea")])
            db.commit()
            self.project_id, self.task_id = project.id, task.id
        self.environment = patch.dict(os.environ, {
            "LOCK_IN_PASSWORD_HASH": auth.make_password_hash("correct horse battery staple"),
            "LOCK_IN_SESSION_SECRET": "s" * 48,
            "GROQ_API_KEY": "fake-key-for-offline-tests", "GROQ_MODEL": assistant.DEFAULT_MODEL,
        })
        self.environment.start()
        with auth._lock:
            auth._attempts.clear()
            auth._assistant_minute.clear()
            auth._assistant_day.clear()

    def tearDown(self):
        self.environment.stop()
        self.engine.dispose()

    def test_password_session_and_login_limit(self):
        self.assertTrue(auth.configured())
        self.assertFalse(auth.verify_password("wrong"))
        self.assertTrue(auth.verify_password("correct horse battery staple"))
        token, csrf = auth.issue_session()
        self.assertEqual(auth.read_session(token)["csrf"], csrf)
        self.assertIsNone(auth.read_session(token + "x"))
        self.assertIsNone(auth.read_session("invalid.not-base64!"))
        for _ in range(5):
            auth.login_limit("isolated-test-ip")
        with self.assertRaises(HTTPException) as raised:
            auth.login_limit("isolated-test-ip")
        self.assertEqual(raised.exception.status_code, 429)
        with patch.dict(os.environ, {"LOCK_IN_PASSWORD_HASH": "", "LOCK_IN_SESSION_SECRET": ""}):
            self.assertFalse(auth.configured())
            self.assertIsNone(auth.read_session(token))

    def test_assistant_rate_and_history_caps(self):
        for _ in range(3):
            auth.assistant_limit()
        with self.assertRaises(HTTPException) as raised:
            auth.assistant_limit()
        self.assertEqual(raised.exception.status_code, 429)
        with self.assertRaises(ValidationError):
            assistant.AskRequest(question="hello", history=[{"role": "user", "content": "x"}] * 5)
        with self.assertRaises(ValidationError):
            assistant.AskRequest(question="x" * 1001)

    def test_selected_task_context_and_explicit_apply(self):
        request = assistant.AskRequest(question="Break this task into steps", intent="breakdown", focus_type="task", focus_id=self.task_id)
        captured = []
        def fake_groq(messages):
            captured.append(messages)
            return assistant.ModelAnswer(answer="Start with the intro.", actions=[action("add_subtask", self.task_id, "Draft intro")])
        with Session(self.engine) as db, patch.object(assistant, "_call_groq", side_effect=fake_groq):
            response = assistant.ask(db, request)
            self.assertEqual(db.query(models.Subtask).count(), 0)
            proposal = response["proposals"][0]
            self.assertEqual(proposal["changes"], [{"field": "New step", "before": "", "after": "Draft intro"}])
            self.assertNotIn("Clean kitchen", str(captured))
            self.assertEqual(assistant.apply(db, proposal["id"])["applied"], True)
            self.assertEqual([step.title for step in db.query(models.Subtask).all()], ["Draft intro"])
            with self.assertRaises(HTTPException) as raised:
                assistant.apply(db, proposal["id"])
            self.assertEqual(raised.exception.status_code, 409)

    def test_project_breakdown_proposes_one_task_at_a_time(self):
        request = assistant.AskRequest(question="Break this project into steps", intent="breakdown", focus_type="project", focus_id=self.project_id)
        fake = assistant.ModelAnswer(answer="Start with the layout.", actions=[action("create_task", title="Design layout", project=self.project_id)])
        with Session(self.engine) as db, patch.object(assistant, "_call_groq", return_value=fake):
            response = assistant.ask(db, request)
            self.assertEqual(db.query(models.Task).count(), 2)
            self.assertEqual(response["proposals"][0]["changes"][0]["after"], "Design layout")
            assistant.apply(db, response["proposals"][0]["id"])
            self.assertEqual(db.query(models.Task).count(), 3)
            self.assertEqual(db.query(models.Task).filter_by(title="Design layout").one().project_id, self.project_id)

    def test_chat_routes_plan_and_named_breakdown_without_other_records(self):
        captured = []
        def fake_groq(messages):
            captured.append(messages)
            return assistant.ModelAnswer(answer="Here is a short plan.", actions=[])
        with Session(self.engine) as db, patch.object(assistant, "_call_groq", side_effect=fake_groq):
            assistant.ask(db, assistant.AskRequest(question="Plan my day today"))
            self.assertIn("Read 20 minutes", str(captured[-1]))
            self.assertNotIn("Portfolio hero idea", str(captured[-1]))
            assistant.ask(db, assistant.AskRequest(question="Break down the task Write portfolio copy into steps"))
            self.assertIn("Write portfolio copy", str(captured[-1]))
            self.assertNotIn("Clean kitchen", str(captured[-1]))
            self.assertNotIn("Portfolio hero idea", str(captured[-1]))

    def test_chat_asks_for_exact_breakdown_target_without_groq(self):
        with Session(self.engine) as db, patch.object(assistant, "_call_groq") as fake_groq:
            result = assistant.ask(db, assistant.AskRequest(question="Break this down into steps"))
            self.assertIn("exact name", result["answer"])
            self.assertEqual(result["proposals"], [])
            fake_groq.assert_not_called()

    def test_rejects_invented_targets_and_stale_edits(self):
        request = assistant.AskRequest(question="Improve this task", intent="breakdown", focus_type="task", focus_id=self.task_id)
        bad = assistant.ModelAnswer(answer="No safe change.", actions=[action("edit_task", 9999, "Invented")])
        with Session(self.engine) as db, patch.object(assistant, "_call_groq", return_value=bad):
            self.assertEqual(assistant.ask(db, request)["proposals"], [])
        good = assistant.ModelAnswer(answer="Suggested title.", actions=[action("edit_task", self.task_id, "Polish copy")])
        with Session(self.engine) as db, patch.object(assistant, "_call_groq", return_value=good):
            proposal = assistant.ask(db, request)["proposals"][0]
            self.assertEqual(proposal["changes"][0]["before"], "Write portfolio copy")
            self.assertEqual(proposal["changes"][0]["after"], "Polish copy")
            db.get(models.Task, self.task_id).title = "Changed elsewhere"
            db.commit()
            with self.assertRaises(HTTPException) as raised:
                assistant.apply(db, proposal["id"])
            self.assertEqual(raised.exception.status_code, 409)

    def test_plan_retrieval_and_error_states(self):
        request = assistant.AskRequest(question="Plan today", intent="plan_today", today=dt.date.today())
        with Session(self.engine) as db:
            context, _, _ = assistant.collect_context(db, request)
            self.assertIn("Write portfolio copy", str(context))
            self.assertIn("Read 20 minutes", str(context))
            self.assertEqual(context["inbox"], [])
            with patch.dict(os.environ, {"GROQ_API_KEY": ""}):
                with self.assertRaises(HTTPException) as raised:
                    assistant.ask(db, request)
                self.assertEqual(raised.exception.status_code, 503)
            for code in (429, 504):
                with patch.object(assistant, "_call_groq", side_effect=HTTPException(code, "Friendly error")):
                    with self.assertRaises(HTTPException) as raised:
                        assistant.ask(db, request)
                    self.assertEqual(raised.exception.status_code, code)

    def test_only_transmitted_ids_are_eligible_for_actions(self):
        request = assistant.AskRequest(question="Plan today", intent="plan_today", today=dt.date.today())
        with Session(self.engine) as db, patch.object(assistant, "MAX_CONTEXT_CHARS", 100):
            context, allowed_tasks, allowed_projects = assistant.collect_context(db, request)
            self.assertEqual(allowed_tasks, {task["id"] for task in context["tasks"]})
            self.assertEqual(allowed_projects, {project["id"] for project in context["projects"]})
            self.assertNotIn(self.task_id, allowed_tasks)

    def test_http_adapter_free_model_and_rate_limit(self):
        captured = []
        class FakeResponse:
            status_code = 429
            headers = {"retry-after": "7"}
        class FakeClient:
            def __init__(self, *args, **kwargs): pass
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def post(self, url, json, headers):
                captured.append((url, json, headers))
                return FakeResponse()
        with patch.object(assistant.httpx, "Client", FakeClient):
            with self.assertRaises(HTTPException) as raised:
                assistant._call_groq([{"role": "user", "content": "hello"}])
        self.assertEqual(raised.exception.status_code, 429)
        self.assertEqual(captured[0][1]["model"], "openai/gpt-oss-20b")
        self.assertEqual(captured[0][1]["max_completion_tokens"], 900)
        self.assertEqual(captured[0][1]["reasoning_effort"], "low")
        with patch.dict(os.environ, {"GROQ_MODEL": "paid-or-unknown"}):
            with self.assertRaises(HTTPException) as raised:
                assistant._call_groq([])
            self.assertEqual(raised.exception.status_code, 503)

    def test_http_adapter_parses_mocked_json_and_timeout(self):
        class FakeResponse:
            status_code = 200
            headers = {}
            def json(self):
                return {"choices": [{"message": {"content": json.dumps({"answer": "Focus on one task.", "actions": []})}}]}
        class FakeClient:
            def __init__(self, *args, **kwargs): pass
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def post(self, *args, **kwargs): return FakeResponse()
        with patch.object(assistant.httpx, "Client", FakeClient):
            self.assertEqual(assistant._call_groq([{"role": "user", "content": "hello"}]).answer, "Focus on one task.")
        class TimeoutClient(FakeClient):
            def post(self, *args, **kwargs):
                raise assistant.httpx.ReadTimeout("Timed out")
        with patch.object(assistant.httpx, "Client", TimeoutClient):
            with self.assertRaises(HTTPException) as raised:
                assistant._call_groq([])
            self.assertEqual(raised.exception.status_code, 504)

    def test_new_proposal_table_preserves_old_records(self):
        legacy = create_engine("sqlite:///:memory:")
        try:
            with legacy.begin() as connection:
                connection.execute(text("CREATE TABLE inbox_entries (id INTEGER PRIMARY KEY, content TEXT NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)"))
                connection.execute(text("INSERT INTO inbox_entries VALUES (1, 'Existing inbox', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"))
            Base.metadata.create_all(legacy)
            self.assertIn("assistant_proposals", inspect(legacy).get_table_names())
            with legacy.connect() as connection:
                self.assertEqual(connection.execute(text("SELECT content FROM inbox_entries WHERE id=1")).scalar_one(), "Existing inbox")
        finally:
            legacy.dispose()


if __name__ == "__main__":
    unittest.main()
