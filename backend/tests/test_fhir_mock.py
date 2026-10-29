"""Run from backend/:  python -m pytest tests/test_fhir_mock.py  (or python tests/test_fhir_mock.py)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import fhir_mock
from verticals.healthcare import DEMO_DATA


def _by_type(bundle, rtype):
    return [e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == rtype]


def test_bundle_contains_linked_resources():
    b = fhir_mock.build_request_bundle(DEMO_DATA)
    claim = _by_type(b, "Claim")[0]
    assert claim["use"] == "preauthorization"
    assert claim["patient"]["reference"] == f"Patient/{_by_type(b, 'Patient')[0]['id']}"
    assert claim["provider"]["reference"] == f"Practitioner/{_by_type(b, 'Practitioner')[0]['id']}"
    assert claim["insurance"][0]["coverage"]["reference"] == f"Coverage/{_by_type(b, 'Coverage')[0]['id']}"
    assert claim["diagnosis"][0]["diagnosisCodeableConcept"]["coding"][0]["code"] == DEMO_DATA["diagnosis_code"]
    assert b["meta"]["tag"][0]["code"] == "simulated"


def test_unmapped_treatment_has_no_invented_code():
    item = _by_type(fhir_mock.build_request_bundle({**DEMO_DATA, "treatment_type": "Surgery"}), "Claim")[0]["item"][0]
    assert item["productOrService"]["coding"] == [] and item["productOrService"]["text"] == "Surgery"


def test_claim_response_links_to_claim_and_carries_denial():
    b = fhir_mock.build_request_bundle(DEMO_DATA)
    claim = _by_type(b, "Claim")[0]
    ok = fhir_mock.build_claim_response(b, "queued")
    assert ok["request"]["reference"] == f"Claim/{claim['id']}" and ok["outcome"] == "queued"
    denied = fhir_mock.build_claim_response(b, "error", "Not medically necessary", "CO-50")
    assert denied["outcome"] == "error" and denied["error"][0]["code"]["coding"][0]["code"] == "CO-50"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
