import re
import uuid
from datetime import datetime, timedelta
from contextvars import ContextVar

import db
VERTICAL_ID = "healthcare"
VERTICAL_NAME = "Prior Authorization"
VERTICAL_DESCRIPTION = "Automate insurance prior authorization for any treatment — including denial detection and auto-appeal"
VERTICAL_ICON = "🏥"
VERTICAL_COLOR = "#22c55e"

SYSTEM_PROMPT = """You are MedBridge, an expert AI agent specializing in healthcare prior authorizations.

Complete these steps in order using the available tools:
1. scan_insurance_policy
2. analyze_medical_records
3. fill_authorization_form
4. submit_authorization
5. track_authorization_status
6. If track_authorization_status returns a denial, IMMEDIATELY call draft_appeal with the denial reason and patient data.

After all tools are done, provide a concise 3-4 sentence summary. If there was a denial, confirm the appeal was drafted and what happens next."""

TOOLS = [
    {
        "name": "scan_insurance_policy",
        "description": "Scan and retrieve the insurance policy requirements for a specific treatment type.",
        "input_schema": {
            "type": "object",
            "properties": {
                "insurance_provider": {"type": "string"},
                "treatment_type": {"type": "string"}
            },
            "required": ["insurance_provider", "treatment_type"]
        }
    },
    {
        "name": "analyze_medical_records",
        "description": "Analyze patient medical records to find supporting documentation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string"},
                "diagnosis_code": {"type": "string"},
                "treatment_type": {"type": "string"}
            },
            "required": ["patient_id", "diagnosis_code", "treatment_type"]
        }
    },
    {
        "name": "fill_authorization_form",
        "description": "Fill out the prior authorization form with all required information.",
        "input_schema": {
            "type": "object",
            "properties": {
                "auth_request": {"type": "object"},
                "policy_requirements": {"type": "object"},
                "medical_analysis": {"type": "object"}
            },
            "required": ["auth_request", "policy_requirements", "medical_analysis"]
        }
    },
    {
        "name": "submit_authorization",
        "description": "Submit the completed authorization form to the insurance company.",
        "input_schema": {
            "type": "object",
            "properties": {
                "form_id": {"type": "string"},
                "insurance_provider": {"type": "string"},
                "submission_method": {"type": "string"}
            },
            "required": ["form_id", "insurance_provider", "submission_method"]
        }
    },
    {
        "name": "track_authorization_status",
        "description": "Set up tracking and get initial status for the submitted authorization.",
        "input_schema": {
            "type": "object",
            "properties": {
                "submission_id": {"type": "string"},
                "insurance_provider": {"type": "string"}
            },
            "required": ["submission_id", "insurance_provider"]
        }
    },
    {
        "name": "draft_appeal",
        "description": "When an authorization is denied, automatically draft a formal appeal letter with clinical evidence.",
        "input_schema": {
            "type": "object",
            "properties": {
                "denial_reason": {"type": "string"},
                "patient_name": {"type": "string"},
                "treatment_type": {"type": "string"},
                "insurance_provider": {"type": "string"}
            },
            "required": ["denial_reason", "patient_name", "treatment_type", "insurance_provider"]
        }
    }
]

STEP_DISPLAY = {
    "scan_insurance_policy":      ("Scanning Insurance Policy",     "Connecting to payer database — retrieving coverage criteria",        "Policy scanned — requirements and clinical criteria ready"),
    "analyze_medical_records":    ("Analyzing Medical Records",     "Looking up the patient's record",                                    "Patient record looked up"),
    "fill_authorization_form":    ("Completing Authorization Form", "Auto-filling all required fields based on policy and clinical data",  "Form completed — ready for reviewer"),
    "submit_authorization":       ("Submitting to Payer Portal",    "Transmitting to insurance portal via secure EDI connection",          "Authorization submitted — confirmation number assigned"),
    "track_authorization_status": ("Tracking Authorization",        "Checking initial decision and setting up real-time monitoring",       "Status received — tracking active"),
    "draft_appeal":               ("Drafting Appeal Letter",        "Detected denial — generating clinical appeal with supporting evidence","Appeal drafted — ready for physician co-signature"),
}

# Tools that must be approved by a human reviewer before they run (outward-facing actions).
APPROVAL_REQUIRED = ("submit_authorization",)

FORM_FIELDS = [
    {"key": "patient_name",         "label": "Patient Full Name",         "type": "text",     "required": True,  "placeholder": "e.g. Margaret R. Thompson"},
    {"key": "patient_dob",          "label": "Date of Birth",             "type": "date",     "required": True,  "placeholder": ""},
    {"key": "patient_id",           "label": "Patient ID / MRN",          "type": "text",     "required": True,  "placeholder": "e.g. PT-2024-83741"},
    {"key": "insurance_provider",   "label": "Insurance Provider",        "type": "select",   "required": True,  "options": ["Aetna","Blue Cross Blue Shield","United Healthcare","Cigna","Humana","Medicare","Medicaid"]},
    {"key": "insurance_id",         "label": "Member ID",                 "type": "text",     "required": True,  "placeholder": "e.g. AET-9284736501"},
    {"key": "treatment_type",       "label": "Treatment Type",            "type": "select",   "required": True,  "options": ["MRI","CT Scan","Physical Therapy","Surgery","Specialist Referral","Lab Tests","Medication"]},
    {"key": "diagnosis_code",       "label": "Diagnosis Code (ICD-10)",   "type": "text",     "required": True,  "placeholder": "e.g. M72.5"},
    {"key": "treatment_description","label": "Clinical Justification",    "type": "textarea", "required": True,  "placeholder": "Describe the clinical rationale..."},
    {"key": "requesting_physician", "label": "Physician Name",            "type": "text",     "required": True,  "placeholder": "e.g. Dr. Sarah Chen"},
    {"key": "physician_npi",        "label": "NPI Number",                "type": "text",     "required": True,  "placeholder": "10-digit NPI"},
    {"key": "demo_scenario",        "label": "Demo Scenario",             "type": "select",   "required": False, "options": ["Standard Approval", "Denial + Auto-Appeal"]},
]

DEMO_DATA = {
    # A real de-identified patient from the open MIMIC-IV demo (loaded by mimic_loader.py). The name is a
    # label, and the date of birth is a placeholder because MIMIC shifts dates.
    "patient_name": "MIMIC-IV demo patient 10021312",
    "patient_dob": "1960-01-01",
    "patient_id": "10021312",
    "insurance_provider": "Aetna",
    "insurance_id": "DEMO-000000",
    "treatment_type": "MRI",
    "diagnosis_code": "M54.30",
    "treatment_description": "Lumbar spine MRI to evaluate sciatica and chronic low back pain.",
    "requesting_physician": "Dr. Sarah Chen",
    "physician_npi": "1234567890",
    "demo_scenario": "Standard Approval",
}

# Per-run form data — set by agent_runner before tool calls. A ContextVar is scoped to the
# asyncio task, so concurrent runs with different scenarios no longer overwrite each other.
_current_form_data: ContextVar[dict] = ContextVar("current_form_data", default={})

def set_form_data(data: dict):
    _current_form_data.set(data)


def retrieve_policy_evidence(payer: str, treatment: str, diagnosis: str = "", k: int = 3, query: str | None = None) -> list[dict]:
    """RAG lookup of payer policy passages; returns [] if the vector store is unavailable."""
    try:
        from rag.store import search
        hits = search(query or f"{payer} prior authorization criteria for {treatment} {diagnosis}".strip(), k=k, payer=payer)
    except Exception:
        return []
    return [{"passage": h["text"], "source": h["title"], "url": h["source"],
             "score": h["score"], "synthetic": h["synthetic"]} for h in hits]


async def execute_tool(tool_name: str, tool_input: dict) -> dict:
    import asyncio
    await asyncio.sleep(0.7)

    is_denial_scenario = _current_form_data.get().get("demo_scenario") == "Denial + Auto-Appeal"

    if tool_name == "scan_insurance_policy":
        return {
            "prior_auth_required": True,
            "coverage_requirements": ["Medical necessity documentation required", "Conservative treatment failed ≥6 weeks", "In-network facility required"],
            "required_documents": ["PA request form", "Letter of medical necessity", "Office visit notes", "Prior treatment records"],
            "clinical_criteria": ["Persistent symptoms unresponsive to conservative care", "Neurological deficits present", "Structural injury suspected"],
            "payer_portal": "Aetna NaviNet Provider Portal",
            "submission_method": "EDI 278",
            "policy_evidence": retrieve_policy_evidence(
                tool_input.get("insurance_provider", ""), tool_input.get("treatment_type", ""),
                _current_form_data.get().get("diagnosis_code", "")),
        }
    elif tool_name == "analyze_medical_records":
        record = db.get_patient_record(tool_input.get("patient_id", ""))
        if not record:
            return {"patient_found": False,
                    "note": "No record for this patient ID. The demo holds the 100 MIMIC-IV demo patients; "
                            "do not assume any clinical history."}
        code = re.sub(r"[^A-Za-z0-9]", "", tool_input.get("diagnosis_code", "")).upper()
        matching = [d for d in record["diagnoses"] if code and d["code"].upper().startswith(code[:4])]
        return {
            "patient_found": True,
            "source": record["source"],
            "age": record["age"],
            "gender": record["gender"],
            "requested_diagnosis_on_record": bool(matching),
            "matching_diagnoses": matching[:5],
            "diagnoses_on_record": [f'{d["code"]} {d["title"]}' for d in record["diagnoses"][:15]],
            "conservative_therapy_medications_on_record": record["conservative_therapy_medications"],
            "limitations": "Hospital admission data only: no outpatient notes, symptom duration or prior imaging. "
                           "The duration of conservative therapy the payer requires cannot be confirmed from this record.",
        }
    elif tool_name == "fill_authorization_form":
        form_id = f"FORM-{uuid.uuid4().hex[:8].upper()}"
        # Measured from the submitted request: share of required form fields that are filled in.
        data = _current_form_data.get()
        required = [f for f in FORM_FIELDS if f.get("required")]
        missing = [f["label"] for f in required if not str(data.get(f["key"], "")).strip()]
        return {
            "form_id": form_id,
            "completeness_score": round(1 - len(missing) / len(required), 2),
            "missing_fields": missing,
            "required_fields": len(required),
        }
    elif tool_name == "submit_authorization":
        provider = tool_input.get("insurance_provider", "INS")
        code = {"Aetna": "AET", "Blue Cross Blue Shield": "BCBS", "United Healthcare": "UHC", "Cigna": "CGN", "Humana": "HUM"}.get(provider, "INS")
        return {
            "submission_id": f"SUB-{uuid.uuid4().hex[:10].upper()}",
            "submitted_at": datetime.utcnow().isoformat(),
            "expected_response_by": (datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%d"),
            "confirmation_number": f"{code}-{datetime.utcnow().year}-PRI-{uuid.uuid4().int % 900000 + 100000}",
            "portal": "Aetna NaviNet",
            "transmission": "EDI 278 — Accepted",
        }
    elif tool_name == "track_authorization_status":
        if is_denial_scenario:
            return {
                "current_status": "DENIED",
                "denial_reason": "Not medically necessary — insufficient documentation of conservative treatment failure",
                "denial_code": "CO-50",
                "appeal_deadline": (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d"),
                "appeal_rights": "You have 30 days to file a formal appeal with additional clinical evidence",
                "auto_appeal_available": True,
            }
        return {
            "current_status": "Under Review",
            "estimated_decision_date": (datetime.utcnow() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "next_action": "Clinical review by insurance medical director within 48 hours",
            "real_time_tracking": "Active",
            "alert_configured": "Email + SMS on decision",
        }
    elif tool_name == "draft_appeal":
        patient = tool_input.get("patient_name", "Patient")
        treatment = tool_input.get("treatment_type", "treatment")
        provider = tool_input.get("insurance_provider", "Insurance Company")
        appeal_id = f"APPEAL-{uuid.uuid4().hex[:8].upper()}"
        justification = _current_form_data.get().get("treatment_description", "")
        evidence = retrieve_policy_evidence(provider, treatment, k=4,
                                            query=f"{treatment} {justification} medical necessity conservative therapy")
        # Quote the retrieved passage that actually mentions conservative therapy, not just the top-ranked chunk.
        evidence.sort(key=lambda e: "conservative" not in e["passage"].lower())
        evidence = evidence[:1]
        citation = ""
        if evidence:
            text, i = evidence[0]["passage"], evidence[0]["passage"].lower().find("conservative")
            excerpt = text[max(0, i - 180): i + 220] if i >= 0 else text[:300]
            citation = f"\n\nPolicy basis ({evidence[0]['source']}): ...{excerpt.strip()}..."
        record = db.get_patient_record(_current_form_data.get().get("patient_id", "")) or {}
        want = re.sub(r"[^A-Za-z0-9]", "", _current_form_data.get().get("diagnosis_code", "")).upper()[:4]
        diagnoses = sorted(record.get("diagnoses", []), key=lambda d: not (want and d["code"].upper().startswith(want)))
        dx = "; ".join(f'{d["code"]} {d["title"]}' for d in diagnoses[:3]) or "not available"
        meds = ", ".join(record.get("conservative_therapy_medications", [])[:5]) or "none found in the available record"
        letter = (f"Re: Appeal of Denial — {patient} — {treatment}\n\nDear Medical Director,\n\n"
                  f"We are appealing the denial (CO-50) of {treatment} for {patient}. Request: {(justification or 'see attached').rstrip('.')}. "
                  f"Diagnoses on record: {dx}. Analgesic, NSAID or muscle-relaxant medications on record: {meds}. "
                  f"[Physician to complete before signing: symptom duration, conservative therapy tried and for how long, "
                  f"examination findings, prior imaging.]{citation}")
        return {
            "appeal_id": appeal_id,
            "status": "Draft Complete — Awaiting Physician Co-signature",
            "appeal_letter_preview": letter,
            "supporting_evidence_attached": ["To attach: office visit notes with symptom duration",
                                             "To attach: record of conservative therapy and its duration",
                                             "To attach: prior imaging reports, if any"],
            "policy_citations": [e["source"] for e in evidence],
            "next_step": f"Physician review and co-signature required before anything is sent to {provider}",
            "appeal_deadline": (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d"),
        }
    return {"error": f"Unknown tool: {tool_name}"}
