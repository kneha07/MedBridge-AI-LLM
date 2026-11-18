"""MCP server tools (no model, no index: policy search is not exercised here)."""
import asyncio

import pytest

pytest.importorskip("mcp")
import mcp_server


def test_submission_is_not_exposed():
    names = {t.name for t in asyncio.run(mcp_server.mcp.list_tools())}
    assert {"search_policy", "analyze_patient_record", "draft_appeal", "build_prior_auth_request"} <= names
    assert not any("submit" in n or "track" in n for n in names)


def test_sample_patient_loads_and_is_analyzed():
    loaded = mcp_server.load_sample_patient("sample-pt-8-weeks.json")
    assert loaded["patient_id"].startswith("upload-")
    result = asyncio.run(mcp_server.analyze_patient_record(loaded["patient_id"], "M54.50"))
    assert result["patient_found"] is True
    assert result["conservative_therapy"]["total_weeks"] > 0


def test_unknown_sample_and_bad_json_are_refused():
    with pytest.raises(ValueError):
        mcp_server.load_sample_patient("../main.py")
    with pytest.raises(ValueError):
        mcp_server.import_fhir_bundle("not json")


def test_unknown_patient_reports_not_found():
    assert asyncio.run(mcp_server.analyze_patient_record("no-such-id"))["patient_found"] is False


def test_request_bundle_is_a_preauthorization_claim():
    bundle = mcp_server.build_prior_auth_request("Test Patient", "1970-01-01", "Aetna", "DEMO-1", "MRI", "M54.50",
                                                 "Dr. Demo")
    claim = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Claim")
    assert claim["use"] == "preauthorization"


def test_appeal_draft_uses_the_record_and_needs_a_physician():
    loaded = mcp_server.load_sample_patient("sample-pt-8-weeks.json")
    draft = asyncio.run(mcp_server.draft_appeal("Test Patient", "MRI", "Aetna", loaded["patient_id"], "M54.50",
                                                "Lumbar MRI after physical therapy"))
    assert "Conservative therapy with recorded dates" in draft["appeal_letter_preview"]
    assert "Physician" in draft["next_step"]
