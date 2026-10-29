"""Run from backend/:  python -m pytest tests/test_auth.py
No LLM call is made and the real database is not written (db.save is stubbed)."""
import asyncio
import sqlite3
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

import auth
import main
from models import WorkflowStatus, WorkflowStatusResponse

USERS = "alice:reviewer:2468,bob:staff:1357,carol:reviewer:9999"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(main.db, "_conn", sqlite3.connect(":memory:", check_same_thread=False))  # never the real database
    auth._failures.clear()
    monkeypatch.setenv("MEDBRIDGE_USERS", USERS)
    monkeypatch.setenv("MEDBRIDGE_SECRET", "test-secret")
    monkeypatch.setattr(main.db, "save", lambda wf: None)
    yield TestClient(main.app)
    main.store.pop("wf-test", None)
    main.approvals.pop("wf-test", None)


def token(client, name, pin):
    r = client.post("/api/auth/login", json={"username": name, "password": pin})
    return {"Authorization": f"Bearer {r.json()['token']}"} if r.status_code == 200 else None


def awaiting_workflow(submitted_by):
    wf = WorkflowStatusResponse(workflow_id="wf-test", vertical_id="healthcare", ai_provider="groq",
                                status=WorkflowStatus.awaiting_approval, created_at="t", updated_at="t",
                                submitted_by=submitted_by)
    main.store["wf-test"] = wf
    main.approvals["wf-test"] = {"event": asyncio.Event(), "approved": False}
    return wf


def test_off_when_switched_off(monkeypatch):
    monkeypatch.setenv("MEDBRIDGE_AUTH", "off")
    c = TestClient(main.app)
    assert c.get("/api/auth/config").json()["enabled"] is False
    assert c.get("/api/workflow/history/all").status_code == 200  # open, as before


def test_on_by_default_with_demo_accounts(monkeypatch):
    monkeypatch.delenv("MEDBRIDGE_USERS", raising=False)
    monkeypatch.delenv("MEDBRIDGE_AUTH", raising=False)
    c = TestClient(main.app)
    cfg = c.get("/api/auth/config").json()
    assert cfg["enabled"] is True and {a["name"] for a in cfg["demo_accounts"]} == {"alice", "bob"}
    assert c.get("/api/workflow/history/all").status_code == 401


def test_custom_users_replace_demo_accounts_and_are_not_advertised(client):
    cfg = client.get("/api/auth/config").json()
    assert cfg["enabled"] is True and cfg["demo_accounts"] == []


def test_login_and_wrong_pin(client):
    assert token(client, "alice", "2468")
    assert token(client, "alice", "0000") is None
    assert token(client, "nobody", "2468") is None


def test_endpoints_need_a_token(client):
    for method, url in [("get", "/api/workflow/history/all"), ("get", "/api/workflow/x/status"),
                        ("post", "/api/workflow/submit"), ("post", "/api/workflow/x/approve"),
                        ("post", "/api/chat"), ("post", "/api/demo/reset")]:
        assert getattr(client, method)(url).status_code == 401, url
    assert client.get("/api/workflow/history/all", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_staff_cannot_approve_or_reset(client):
    awaiting_workflow("bob")
    h = token(client, "bob", "1357")
    assert client.post("/api/workflow/wf-test/approve", json={"approved": True}, headers=h).status_code == 403
    assert client.post("/api/demo/reset", headers=h).status_code == 403
    assert main.store["wf-test"].status == WorkflowStatus.awaiting_approval


def test_submitter_cannot_approve_own_request(client):
    awaiting_workflow("alice")
    h = token(client, "alice", "2468")
    r = client.post("/api/workflow/wf-test/approve", json={"approved": True}, headers=h)
    assert r.status_code == 403 and "someone other" in r.json()["detail"]


def test_other_reviewer_approves_and_is_recorded_by_signed_name(client):
    wf = awaiting_workflow("bob")
    h = token(client, "carol", "9999")
    r = client.post("/api/workflow/wf-test/approve", json={"approved": True, "reviewer": "Someone Else"}, headers=h)
    assert r.status_code == 200
    assert wf.audit[-1]["actor"] == "carol" and wf.audit[-1]["action"] == "approved"


def test_tampered_expired_and_removed_tokens(client, monkeypatch):
    t = auth.login("bob", "1357")
    body, sig = t.rsplit(".", 1)
    assert auth.verify(t).role == "staff"
    assert auth.verify(body + "." + "0" * len(sig)) is None
    monkeypatch.setattr(time, "time", lambda: time.monotonic() + 10**10)
    assert auth.verify(t) is None
    monkeypatch.undo()
    monkeypatch.setenv("MEDBRIDGE_USERS", "alice:reviewer:2468")  # bob removed
    monkeypatch.setenv("MEDBRIDGE_SECRET", "test-secret")
    assert auth.verify(t) is None


def test_bad_role_in_config_is_rejected(monkeypatch):
    monkeypatch.setenv("MEDBRIDGE_USERS", "x:admin:1")
    with pytest.raises(ValueError):
        auth.enabled()


def signup(client, full_name="Dana Lee", email="dana@clinic.org", password="correct horse", organization="Riverside Clinic", **extra):
    return client.post("/api/auth/register", json={"full_name": full_name, "email": email, "password": password,
                                                   "organization": organization, **extra})


def test_signup_creates_staff_and_can_sign_in_with_email(client):
    r = signup(client)
    assert r.status_code == 201 and r.json()["role"] == "staff"
    assert r.json()["display"] == "Dana Lee" and r.json()["name"] == "dana@clinic.org"
    assert token(client, "dana@clinic.org", "correct horse")
    assert token(client, "DANA@Clinic.org", "correct horse")  # email is not case sensitive
    assert token(client, "dana@clinic.org", "wrong password") is None
    assert client.get("/api/workflow/history/all", headers={"Authorization": f"Bearer {r.json()['token']}"}).status_code == 200


def test_signup_validation(client):
    assert signup(client, full_name="D").status_code == 400                       # name too short
    assert signup(client, full_name="9lives").status_code == 400                  # must start with a letter
    assert signup(client, email="not-an-email").status_code == 400
    assert signup(client, email="a@b").status_code == 400
    assert signup(client, password="short").status_code == 400
    assert signup(client, organization="x" * 81).status_code == 400
    assert signup(client, organization="").status_code == 201                     # organization is optional


def test_duplicate_email_is_refused_ignoring_case(client):
    assert signup(client).status_code == 201
    assert signup(client, full_name="Someone Else", email="DANA@clinic.org", password="another pass").status_code == 409


def test_password_is_not_stored_in_plain_text(client):
    signup(client)
    row = main.db.get_user("dana@clinic.org")
    assert b"correct horse" not in row["hash"] and len(row["salt"]) == 16
    assert row["display"] == "Dana Lee" and row["organization"] == "Riverside Clinic"


def test_signup_cannot_choose_reviewer(client):
    r = signup(client, role="reviewer")
    assert r.json()["role"] == "staff"


def test_audit_label_shows_full_name_and_login(client):
    r = signup(client).json()
    user = auth.verify(r["token"])
    assert user.label == "Dana Lee (dana@clinic.org)"
    assert auth.verify(auth.login("bob", "1357")).label == "bob"


def test_existing_users_table_from_an_older_version_is_upgraded(client):
    main.db._conn.execute("CREATE TABLE users (name TEXT PRIMARY KEY, role TEXT NOT NULL, salt BLOB NOT NULL, hash BLOB NOT NULL, created_at TEXT NOT NULL)")
    assert signup(client).status_code == 201


def test_reviewer_can_promote_but_staff_cannot(client):
    signup(client)
    staff, boss = token(client, "bob", "1357"), token(client, "alice", "2468")
    assert client.post("/api/users/dana@clinic.org/role", json={"role": "reviewer"}, headers=staff).status_code == 403
    assert client.get("/api/users", headers=staff).status_code == 403
    assert client.post("/api/users/dana@clinic.org/role", json={"role": "reviewer"}, headers=boss).status_code == 200
    assert auth.verify(auth.login("dana@clinic.org", "correct horse")).role == "reviewer"
    assert client.post("/api/users/alice/role", json={"role": "staff"}, headers=boss).status_code == 403   # not yourself
    assert client.post("/api/users/bob/role", json={"role": "reviewer"}, headers=boss).status_code == 400  # config account
    assert client.post("/api/users/nobody/role", json={"role": "staff"}, headers=boss).status_code == 404
    assert {u["name"] for u in client.get("/api/users", headers=boss).json()} >= {"alice", "bob", "dana@clinic.org"}


def test_old_token_stops_working_after_demotion(client):
    signup(client)
    boss = token(client, "alice", "2468")
    client.post("/api/users/dana@clinic.org/role", json={"role": "reviewer"}, headers=boss)
    dana = auth.login("dana@clinic.org", "correct horse")
    client.post("/api/users/dana@clinic.org/role", json={"role": "staff"}, headers=boss)
    assert auth.verify(dana) is None


def test_lockout_after_repeated_failures(client):
    for _ in range(auth.MAX_FAILURES):
        assert token(client, "bob", "0000") is None
    r = client.post("/api/auth/login", json={"username": "bob", "password": "1357"})
    assert r.status_code == 429  # locked even for the right PIN
    assert token(client, "alice", "2468")  # other accounts unaffected
