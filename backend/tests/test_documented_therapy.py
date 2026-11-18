"""Therapy duration quoted in the appeal letter: recorded dates only (no index, no model)."""
import asyncio
import json
from pathlib import Path

import fhir_import
from verticals import healthcare
from verticals.healthcare import documented_therapy

SAMPLE = Path(__file__).parent.parent / "samples" / "sample-pt-8-weeks.json"


def test_overlapping_intervals_are_counted_once():
    therapy = {"therapy": [{"start": "2026-01-01", "end": "2026-01-29"}],
               "medications": [{"start": "2026-01-15", "end": "2026-02-12"}]}
    assert documented_therapy(therapy)["weeks"] == 6.0


def test_separate_intervals_add_up_and_gaps_do_not_count():
    therapy = {"therapy": [{"start": "2026-01-01", "end": "2026-01-15"}, {"start": "2026-03-01", "end": "2026-03-15"}],
               "medications": []}
    assert documented_therapy(therapy)["weeks"] == 4.0


def test_open_ended_prescription_is_not_counted():
    therapy = {"therapy": [], "medications": [{"start": "2026-01-01", "end": None}]}
    doc = documented_therapy(therapy)
    assert doc["weeks"] == 0 and doc["open_ended_prescriptions"] == 1 and doc["start"] is None


def test_figure_does_not_grow_with_the_record_date():
    bundle = json.loads(SAMPLE.read_text())
    early = documented_therapy(fhir_import.record_from_bundle(bundle, as_of="2026-03-15")["conservative_therapy"])
    late = documented_therapy(fhir_import.record_from_bundle(bundle, as_of="2027-03-15")["conservative_therapy"])
    assert early["weeks"] == late["weeks"] and 7 <= early["weeks"] <= 9  # the sample is "physical therapy, 8 weeks"


def test_appeal_letter_quotes_recorded_dates_only():
    record = fhir_import.record_from_bundle(json.loads(SAMPLE.read_text()), as_of="2027-03-15")
    pid = fhir_import.save_upload(record, "test")
    healthcare.set_form_data({"patient_id": pid, "diagnosis_code": "M54.50", "treatment_description": "Lumbar MRI"})
    letter = asyncio.run(healthcare.execute_tool("draft_appeal", {"patient_name": "T", "treatment_type": "MRI",
                                                                  "insurance_provider": "Aetna"}))["appeal_letter_preview"]
    assert f"about {documented_therapy(record['conservative_therapy'])['weeks']:g} weeks" in letter
    assert "no stop date are not counted" in letter
