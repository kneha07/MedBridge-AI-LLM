"""MCP server: MedBridge's lookup and drafting tools for MCP clients such as Claude Desktop.

Run with `python mcp_server.py` (stdio). It exposes policy search, patient-record analysis, the
FHIR-shaped request builder and the appeal draft. Submission and tracking are deliberately NOT
exposed: in the web app they sit behind the human approval gate, and an MCP client has no such gate.
Payers are simulated and nothing is sent anywhere. Demo data only; not for real patient data.
"""
import json
from pathlib import Path

try:  # mcp 2.x
    from mcp.server.mcpserver import MCPServer as _Server
except ImportError:  # mcp 1.x
    from mcp.server.fastmcp import FastMCP as _Server

import fhir_import
import fhir_mock
from verticals import healthcare

SAMPLES_DIR = Path(__file__).parent / "samples"

mcp = _Server("medbridge")


@mcp.tool()
def search_policy(query: str, payer: str = "", k: int = 4) -> list[dict]:
    """Search the payer policy documents. Returns cited passages (text, title, source URL, payer, score).
    Give `payer` to search only that payer's documents; a payer with no documents in the corpus returns nothing."""
    from rag import store  # imported here so the other tools work before the index is built
    return store.search(query, k=max(1, min(int(k), 10)), payer=payer or None)


@mcp.tool()
def list_sample_patients() -> list[str]:
    """File names of the synthetic sample patients (FHIR R4 bundles) that load_sample_patient accepts."""
    return sorted(p.name for p in SAMPLES_DIR.glob("*.json"))


@mcp.tool()
def load_sample_patient(file: str) -> dict:
    """Load one synthetic sample patient. Returns a patient_id, valid for two hours, and a short summary."""
    if file not in list_sample_patients():
        raise ValueError(f"No such sample. Choose one of: {', '.join(list_sample_patients())}")
    return import_fhir_bundle((SAMPLES_DIR / file).read_text(encoding="utf-8"))


@mcp.tool()
def import_fhir_bundle(bundle_json: str) -> dict:
    """Read a FHIR R4 patient bundle given as JSON text. The record is kept in memory for two hours and never
    saved. Returns a patient_id for analyze_patient_record. Synthetic or de-identified data only."""
    try:
        bundle = json.loads(bundle_json)
    except ValueError:
        raise ValueError("bundle_json is not valid JSON")
    record = fhir_import.record_from_bundle(bundle)
    patient_id = fhir_import.save_upload(record, "mcp")
    return {"patient_id": patient_id, "expires_in_seconds": fhir_import.UPLOAD_TTL, "summary": fhir_import.summary(record)}


@mcp.tool()
async def analyze_patient_record(patient_id: str, diagnosis_code: str = "", treatment_type: str = "") -> dict:
    """Diagnoses, analgesic medication and, for outpatient records, the conservative-therapy history on a
    patient's record, with the limits of that record. `patient_id` is a MIMIC-IV demo id, a Synthea id or an
    id returned by import_fhir_bundle / load_sample_patient."""
    return await healthcare.execute_tool("analyze_medical_records", {
        "patient_id": patient_id, "diagnosis_code": diagnosis_code, "treatment_type": treatment_type})


@mcp.tool()
def build_prior_auth_request(patient_name: str, patient_dob: str, insurance_provider: str, insurance_id: str,
                             treatment_type: str, diagnosis_code: str, requesting_physician: str,
                             physician_npi: str = "", treatment_description: str = "") -> dict:
    """Build the FHIR-shaped prior-authorization request (a Bundle with a Claim, use=preauthorization).
    Simulated: it is not validated against the Da Vinci profiles and is never sent to a payer."""
    return fhir_mock.build_request_bundle({
        "patient_name": patient_name, "patient_dob": patient_dob, "insurance_provider": insurance_provider,
        "insurance_id": insurance_id, "treatment_type": treatment_type, "diagnosis_code": diagnosis_code,
        "requesting_physician": requesting_physician, "physician_npi": physician_npi,
        "treatment_description": treatment_description})


@mcp.tool()
async def draft_appeal(patient_name: str, treatment_type: str, insurance_provider: str, patient_id: str = "",
                       diagnosis_code: str = "", clinical_justification: str = "") -> dict:
    """Draft an appeal letter for a denied request, citing the retrieved policy passage when one is found and
    the patient's record when `patient_id` is given. A draft only: it needs physician review and signature."""
    healthcare.set_form_data({"patient_id": patient_id, "diagnosis_code": diagnosis_code,
                              "treatment_description": clinical_justification})
    return await healthcare.execute_tool("draft_appeal", {
        "patient_name": patient_name, "treatment_type": treatment_type, "insurance_provider": insurance_provider})


if __name__ == "__main__":
    mcp.run()
