"""FHIR bundle upload: parsing, what FHIR cannot carry, and the upload endpoint (no LLM calls)."""
import asyncio
import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import fhir_import
import main
from verticals import healthcare

SAMPLES = Path(__file__).parent.parent / "samples"


def sample(name="sample-pt-8-weeks.json"):
    return json.loads((SAMPLES / name).read_text())


def test_timestamps_are_converted_to_utc_before_taking_the_date():
    assert fhir_import._utc("2026-01-05T23:30:00-08:00") == "2026-01-06T07:30:00Z"
    assert fhir_import._utc("2026-01-05") == "2026-01-05"


def test_sample_becomes_the_same_record_shape_as_the_synthea_loader():
    r = fhir_import.record_from_bundle(sample(), as_of="2026-11-17")
    assert r["first_back_pain_diagnosis_date"] == "2026-01-03"
    assert any(d.get("icd10") == "M54.50" for d in r["diagnoses"])
    pt = r["conservative_therapy"]["therapy"][0]
    assert (pt["type"], pt["sessions"], pt["start"], pt["end"]) == ("physical therapy", 10, "2026-01-06", "2026-02-28")
    assert len(r["back_pain_encounters"]) == 11


def test_completed_prescriptions_count_one_day_and_active_ones_stay_open():
    meds = fhir_import.record_from_bundle(sample(), as_of="2026-11-17")["conservative_therapy"]["medications"]
    done, active = meds
    assert done["stop_date_unknown"] and done["end"] == done["start"]
    assert active["end"] is None and "stop_date_unknown" not in active


@pytest.mark.parametrize("bundle, message", [
    ({"resourceType": "Patient"}, "not a FHIR Bundle"),
    ({"resourceType": "Bundle", "entry": []}, "exactly one Patient"),
    ({"resourceType": "Bundle", "entry": [{"resource": {"resourceType": "Patient", "id": "a"}}] * 2}, "exactly one Patient"),
    ({"resourceType": "Bundle", "entry": [{"resource": {"resourceType": "Patient", "id": "a"}}]}, "no birth date"),
])
def test_unusable_bundles_are_rejected_with_a_reason(bundle, message):
    with pytest.raises(fhir_import.BundleError, match=message):
        fhir_import.record_from_bundle(bundle)


@pytest.fixture
def client(monkeypatch):
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    monkeypatch.setattr(main.db, "_conn", conn)
    monkeypatch.setenv("MEDBRIDGE_AUTH", "off")
    yield TestClient(main.app), conn


def test_upload_is_readable_by_the_agent_but_not_stored(client):
    c, conn = client
    res = c.post("/api/patient-records/upload",
                 files={"file": ("p.json", (SAMPLES / "sample-pt-8-weeks.json").read_bytes(), "application/json")})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["patient_id"].startswith("upload-") and body["summary"]["suggested_diagnosis_code"] == "M54.50"
    assert body["summary"]["therapy_sessions"] == 10

    found = asyncio.run(healthcare.execute_tool("analyze_medical_records",
                                                {"patient_id": body["patient_id"], "diagnosis_code": "M54.50"}))
    assert found["patient_found"] and found["requested_diagnosis_on_record"]
    assert "stop date" in found["limitations"] and found["timeline"]["therapy"][0]["sessions"] == 10

    tables = [t for (t,) in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    for t in tables:
        assert not any(body["patient_id"] in str(row) for row in conn.execute(f"SELECT * FROM {t}"))


def test_upload_rejects_non_json_and_unknown_samples(client):
    c, _ = client
    res = c.post("/api/patient-records/upload", files={"file": ("x.txt", b"hello", "text/plain")})
    assert res.status_code == 400 and "not JSON" in res.json()["detail"]
    assert c.get("/api/patient-records/samples/../main.py").status_code == 404
    assert c.get("/api/patient-records/samples/sample-no-therapy.json").status_code == 200
