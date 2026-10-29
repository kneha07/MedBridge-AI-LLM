"""FHIR-shaped mock of a prior-authorization exchange (simulated; nothing is sent anywhere).

Follows the general shape of the HL7 Da Vinci Prior Authorization Support exchange: a request Bundle that holds a
Claim with use=preauthorization plus the Patient, Practitioner, Organization and Coverage it refers to, answered by a
ClaimResponse. It is FHIR-shaped, not validated against any implementation guide profile, and uses placeholder
identifiers and code mappings only for the demo.
"""
import uuid
from datetime import datetime, timezone

# Demo mapping from the form's treatment type to a procedure code. Placeholder codes for the simulation.
PROCEDURE_CODES = {
    "MRI": ("CPT", "72148", "MRI lumbar spine without contrast"),
    "CT Scan": ("CPT", "72131", "CT lumbar spine without contrast"),
    "Physical Therapy": ("CPT", "97110", "Therapeutic exercises"),
}

SYSTEMS = {
    "ICD-10": "http://hl7.org/fhir/sid/icd-10-cm",
    "CPT": "http://www.ama-assn.org/go/cpt",
    "NPI": "http://hl7.org/fhir/sid/us-npi",
    "claim-type": "http://terminology.hl7.org/CodeSystem/claim-type",
    "processpriority": "http://terminology.hl7.org/CodeSystem/processpriority",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _rid() -> str:
    return uuid.uuid4().hex[:12]


def build_request_bundle(form: dict) -> dict:
    """Build the request Bundle for a prior-authorization submission from the form data."""
    patient_id, org_id, prac_id, cov_id, claim_id = (_rid() for _ in range(5))
    treatment = form.get("treatment_type", "")
    system, code, display = PROCEDURE_CODES.get(treatment, ("CPT", "", treatment))
    diagnosis = form.get("diagnosis_code", "").strip()

    patient = {"resourceType": "Patient", "id": patient_id,
               "identifier": [{"system": "urn:medbridge:demo-patient-id", "value": form.get("patient_id", "")}],
               "name": [{"text": form.get("patient_name", "")}], "birthDate": form.get("patient_dob", "")}
    payer = {"resourceType": "Organization", "id": org_id, "name": form.get("insurance_provider", "")}
    practitioner = {"resourceType": "Practitioner", "id": prac_id,
                    "identifier": [{"system": SYSTEMS["NPI"], "value": form.get("physician_npi", "")}],
                    "name": [{"text": form.get("requesting_physician", "")}]}
    coverage = {"resourceType": "Coverage", "id": cov_id, "status": "active",
                "subscriberId": form.get("insurance_id", ""),
                "beneficiary": {"reference": f"Patient/{patient_id}"},
                "payor": [{"reference": f"Organization/{org_id}"}]}
    item = {"sequence": 1,
            "productOrService": {"coding": [{"system": SYSTEMS[system], "code": code, "display": display}]
                                 if code else [], "text": treatment}}
    claim = {"resourceType": "Claim", "id": claim_id, "status": "active",
             "type": {"coding": [{"system": SYSTEMS["claim-type"], "code": "professional"}]},
             "use": "preauthorization", "created": _now(),
             "patient": {"reference": f"Patient/{patient_id}"},
             "provider": {"reference": f"Practitioner/{prac_id}"},
             "insurer": {"reference": f"Organization/{org_id}"},
             "priority": {"coding": [{"system": SYSTEMS["processpriority"], "code": "normal"}]},
             "insurance": [{"sequence": 1, "focal": True, "coverage": {"reference": f"Coverage/{cov_id}"}}],
             "diagnosis": [{"sequence": 1, "diagnosisCodeableConcept": {
                 "coding": [{"system": SYSTEMS["ICD-10"], "code": diagnosis}]}}] if diagnosis else [],
             "supportingInfo": [{"sequence": 1, "category": {"text": "clinical-justification"},
                                 "valueString": form.get("treatment_description", "")}],
             "item": [item]}
    entries = [claim, patient, practitioner, payer, coverage]
    return {"resourceType": "Bundle", "id": _rid(), "type": "collection", "timestamp": _now(),
            "meta": {"tag": [{"system": "urn:medbridge", "code": "simulated",
                              "display": "Simulated, FHIR-shaped, not validated"}]},
            "entry": [{"fullUrl": f"urn:uuid:{r['id']}", "resource": r} for r in entries]}


def build_claim_response(bundle: dict, outcome: str, reason: str = "", code: str = "") -> dict:
    """Build the ClaimResponse for a request Bundle. outcome is 'queued' (pended for review) or 'error' (denied)."""
    claim = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Claim")
    resp = {"resourceType": "ClaimResponse", "id": _rid(), "status": "active",
            "type": claim["type"], "use": "preauthorization", "created": _now(),
            "patient": claim["patient"], "insurer": claim["insurer"],
            "request": {"reference": f"Claim/{claim['id']}"},
            "outcome": outcome,
            "disposition": {"queued": "Pended for clinical review", "error": f"Denied: {reason}"}.get(outcome, outcome)}
    if outcome == "error":
        resp["error"] = [{"code": {"coding": [{"code": code}], "text": reason}}]
    return resp
