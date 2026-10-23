import uuid
from datetime import datetime, timedelta

VERTICAL_ID = "legal"
VERTICAL_NAME = "Legal Filing"
VERTICAL_DESCRIPTION = "Automate contract review, compliance checks, and court filings"
VERTICAL_ICON = "⚖️"
VERTICAL_COLOR = "#8b5cf6"

SYSTEM_PROMPT = """You are LexBridge, an expert AI agent specializing in legal document processing and court filings.
Complete all 5 steps in order: review contract, check compliance, prepare filing, submit to court, track case status.
After all tools are done, provide a brief 3-4 sentence summary with the case number and expected timeline."""

TOOLS = [
    {
        "name": "review_contract",
        "description": "Review and analyze the contract or legal document for key clauses, risks, and issues.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contract_type": {"type": "string"},
                "parties": {"type": "string"},
                "jurisdiction": {"type": "string"}
            },
            "required": ["contract_type", "parties", "jurisdiction"]
        }
    },
    {
        "name": "check_compliance",
        "description": "Check document against relevant laws, regulations, and jurisdiction requirements.",
        "input_schema": {
            "type": "object",
            "properties": {
                "jurisdiction": {"type": "string"},
                "document_type": {"type": "string"},
                "filing_type": {"type": "string"}
            },
            "required": ["jurisdiction", "document_type", "filing_type"]
        }
    },
    {
        "name": "prepare_filing",
        "description": "Prepare the complete legal filing package with all required forms and attachments.",
        "input_schema": {
            "type": "object",
            "properties": {
                "filing_type": {"type": "string"},
                "jurisdiction": {"type": "string"},
                "review_results": {"type": "object"},
                "compliance_results": {"type": "object"}
            },
            "required": ["filing_type", "jurisdiction", "review_results", "compliance_results"]
        }
    },
    {
        "name": "submit_to_court",
        "description": "Electronically submit the filing package to the appropriate court or legal authority.",
        "input_schema": {
            "type": "object",
            "properties": {
                "filing_id": {"type": "string"},
                "court": {"type": "string"},
                "filing_type": {"type": "string"}
            },
            "required": ["filing_id", "court", "filing_type"]
        }
    },
    {
        "name": "track_case_status",
        "description": "Set up case tracking and retrieve initial docket status.",
        "input_schema": {
            "type": "object",
            "properties": {
                "case_number": {"type": "string"},
                "court": {"type": "string"}
            },
            "required": ["case_number", "court"]
        }
    }
]

STEP_DISPLAY = {
    "review_contract":    ("Reviewing Contract",        "Analyzing key clauses, risks, and obligations",              "Contract reviewed — risk assessment complete"),
    "check_compliance":   ("Checking Compliance",       "Verifying against jurisdiction laws and regulations",         "Compliance verified — all requirements met"),
    "prepare_filing":     ("Preparing Filing Package",  "Assembling all required forms and supporting documents",      "Filing package prepared with complete documentation"),
    "submit_to_court":    ("Submitting to Court",       "Electronically filing with the appropriate court",            "Filing submitted — case number assigned"),
    "track_case_status":  ("Tracking Case Status",      "Initializing docket monitoring and deadline tracking",        "Case tracking active — next hearing date set"),
}

FORM_FIELDS = [
    {"key": "client_name",      "label": "Client Name",         "type": "text",     "required": True,  "placeholder": "e.g. Acme Corporation"},
    {"key": "opposing_party",   "label": "Opposing Party",      "type": "text",     "required": True,  "placeholder": "e.g. XYZ Inc."},
    {"key": "contract_type",    "label": "Document Type",       "type": "select",   "required": True,  "options": ["Commercial Contract","Employment Agreement","NDA","Lease Agreement","Settlement Agreement","Court Motion","Compliance Filing"]},
    {"key": "filing_type",      "label": "Filing Type",         "type": "select",   "required": True,  "options": ["Initial Filing","Motion","Appeal","Response","Complaint","Answer"]},
    {"key": "jurisdiction",     "label": "Jurisdiction",        "type": "select",   "required": True,  "options": ["Federal Court","California Superior Court","New York Supreme Court","Texas District Court","Delaware Chancery Court","Other"]},
    {"key": "case_description", "label": "Matter Description",  "type": "textarea", "required": True,  "placeholder": "Briefly describe the legal matter and filing purpose..."},
    {"key": "attorney_name",    "label": "Attorney of Record",  "type": "text",     "required": True,  "placeholder": "e.g. Jane Smith, Esq."},
    {"key": "bar_number",       "label": "Bar Number",          "type": "text",     "required": True,  "placeholder": "e.g. CA-234567"},
]

DEMO_DATA = {
    "client_name": "Vertex Technologies Inc.",
    "opposing_party": "DataStream Corp.",
    "contract_type": "Commercial Contract",
    "filing_type": "Complaint",
    "jurisdiction": "Delaware Chancery Court",
    "case_description": "Breach of contract claim arising from DataStream Corp.'s failure to deliver contracted software services per SLA terms. Seeking $2.4M in damages plus injunctive relief.",
    "attorney_name": "James L. Harrison, Esq.",
    "bar_number": "DE-087432",
}


async def execute_tool(tool_name: str, tool_input: dict) -> dict:
    import asyncio
    await asyncio.sleep(0.7)

    if tool_name == "review_contract":
        return {
            "risk_level": "Medium",
            "key_clauses_found": ["Indemnification clause", "Limitation of liability", "Dispute resolution", "Force majeure", "Termination rights"],
            "issues_identified": ["Ambiguous SLA definitions", "Missing penalty clause for late delivery"],
            "recommendations": ["Clarify deliverable timelines", "Add liquidated damages clause", "Specify governing law"],
            "review_score": 0.82,
            "notes": "Contract is generally enforceable. Key issues identified that strengthen the breach claim."
        }
    elif tool_name == "check_compliance":
        return {
            "compliant": True,
            "jurisdiction_requirements_met": ["UCC Article 2 compliance", "E-signature validity confirmed", "Statute of limitations within bounds"],
            "required_forms": ["Complaint cover sheet", "Civil case information statement", "Certificate of service"],
            "filing_fee": "$450.00",
            "notes": "All jurisdictional requirements satisfied. Ready to file."
        }
    elif tool_name == "prepare_filing":
        filing_id = f"FIL-{uuid.uuid4().hex[:8].upper()}"
        return {
            "filing_id": filing_id,
            "package_complete": True,
            "documents_included": ["Verified Complaint", "Exhibits A-F", "Civil Cover Sheet", "Summons"],
            "page_count": 47,
            "completeness_score": 0.98
        }
    elif tool_name == "submit_to_court":
        court_codes = {
            "Delaware Chancery Court": "DEL-CH",
            "Federal Court": "FED",
            "California Superior Court": "CA-SUP",
            "New York Supreme Court": "NY-SUP",
        }
        court = tool_input.get("court", "Court")
        code = court_codes.get(court, "CT")
        case_number = f"{code}-{datetime.utcnow().year}-{uuid.uuid4().int % 90000 + 10000}"
        return {
            "case_number": case_number,
            "submitted_at": datetime.utcnow().isoformat(),
            "confirmation_number": case_number,
            "expected_response_by": (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d"),
            "next_hearing": (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d"),
        }
    elif tool_name == "track_case_status":
        return {
            "current_status": "Filed & Pending Service",
            "estimated_decision_date": (datetime.utcnow() + timedelta(days=90)).strftime("%Y-%m-%d"),
            "next_action": "Serve defendant within 20 days per court rules",
            "deadline_alerts_set": True,
            "notes": "Case accepted by court. Docket monitoring active."
        }
    return {"error": f"Unknown tool: {tool_name}"}
