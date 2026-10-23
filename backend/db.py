"""SQLite persistence for workflows (request, steps, audit trail)."""
import sqlite3
from pathlib import Path

from models import WorkflowStatusResponse

DB_PATH = Path(__file__).parent / "medbridge.db"
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
