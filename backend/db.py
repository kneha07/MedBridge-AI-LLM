"""SQLite persistence for workflows (request, steps, audit trail)."""
import os
import sqlite3
from pathlib import Path

from models import WorkflowStatusResponse

DB_PATH = Path(os.environ.get("MEDBRIDGE_DB") or Path(__file__).parent / "medbridge.db")
_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
_conn.execute("CREATE TABLE IF NOT EXISTS workflows (id TEXT PRIMARY KEY, created_at TEXT, data TEXT)")
_conn.commit()


def save(wf: WorkflowStatusResponse) -> None:
    _conn.execute("INSERT OR REPLACE INTO workflows VALUES (?, ?, ?)",
                  (wf.workflow_id, wf.created_at, wf.model_dump_json()))
    _conn.commit()


def load_all() -> list[WorkflowStatusResponse]:
    rows = _conn.execute("SELECT data FROM workflows ORDER BY created_at").fetchall()
    return [WorkflowStatusResponse.model_validate_json(r[0]) for r in rows]


def clear() -> None:
    _conn.execute("DELETE FROM workflows")
    _conn.commit()


# --- patient records (loaded from the open MIMIC-IV demo by mimic_loader.py) ---
_conn.execute("CREATE TABLE IF NOT EXISTS patient_records (subject_id TEXT PRIMARY KEY, data TEXT)")
_conn.commit()


def save_patient_record(subject_id: str, record: dict) -> None:
    import json
    _conn.execute("INSERT OR REPLACE INTO patient_records VALUES (?, ?)", (str(subject_id), json.dumps(record)))
    _conn.commit()


def get_patient_record(subject_id: str) -> dict | None:
    import json
    row = _conn.execute("SELECT data FROM patient_records WHERE subject_id = ?", (str(subject_id).strip(),)).fetchone()
    return json.loads(row[0]) if row else None


# --- user accounts (see auth.py). The password is stored only as a salted scrypt hash. ---
def _users_table() -> None:
    _conn.execute("CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, role TEXT NOT NULL, salt BLOB NOT NULL, "
                  "hash BLOB NOT NULL, created_at TEXT NOT NULL)")
    have = {r[1] for r in _conn.execute("PRAGMA table_info(users)")}
    for col in ("display", "organization"):  # added after the first version of the table
        if col not in have:
            _conn.execute(f"ALTER TABLE users ADD COLUMN {col} TEXT NOT NULL DEFAULT ''")


_USER_COLS = ("name", "role", "salt", "hash", "created_at", "display", "organization")


def create_user(name: str, role: str, salt: bytes, pw_hash: bytes, created_at: str, display: str = "", organization: str = "") -> bool:
    """Insert a user; False if the name (their email) is taken, ignoring case."""
    _users_table()
    if _conn.execute("SELECT 1 FROM users WHERE lower(name) = lower(?)", (name,)).fetchone():
        return False
    _conn.execute("INSERT INTO users (name, role, salt, hash, created_at, display, organization) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  (name, role, salt, pw_hash, created_at, display or name, organization))
    _conn.commit()
    return True


def get_user(name: str) -> dict | None:
    _users_table()
    r = _conn.execute(f"SELECT {', '.join(_USER_COLS)} FROM users WHERE lower(name) = lower(?)", (name,)).fetchone()
    return dict(zip(_USER_COLS, r)) if r else None


def list_users() -> list[dict]:
    _users_table()
    return [{"name": n, "role": r, "created_at": c, "display": d or n, "organization": o} for n, r, c, d, o in
            _conn.execute("SELECT name, role, created_at, display, organization FROM users ORDER BY created_at")]


def set_user_role(name: str, role: str) -> bool:
    _users_table()
    cur = _conn.execute("UPDATE users SET role = ? WHERE lower(name) = lower(?)", (role, name))
    _conn.commit()
    return cur.rowcount > 0
