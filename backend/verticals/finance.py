import uuid
from datetime import datetime, timedelta

VERTICAL_ID = "finance"
VERTICAL_NAME = "Loan Application"
VERTICAL_DESCRIPTION = "Automate loan processing, KYC verification, and lender submission"
VERTICAL_ICON = "💰"
VERTICAL_COLOR = "#f59e0b"

SYSTEM_PROMPT = """You are FinBridge, an expert AI agent specializing in loan application processing and financial compliance.
Complete all 5 steps in order: verify identity, analyze credit, assess risk, prepare application, submit to lender.
After all tools are done, provide a brief 3-4 sentence summary with the application number and expected decision timeline."""

TOOLS = [
    {
        "name": "verify_identity",
        "description": "Verify applicant identity through KYC checks, ID validation, and fraud screening.",
        "input_schema": {
            "type": "object",
            "properties": {
                "applicant_name": {"type": "string"},
                "ssn_last4": {"type": "string"},
                "date_of_birth": {"type": "string"}
            },
            "required": ["applicant_name", "ssn_last4", "date_of_birth"]
        }
    },
    {
        "name": "analyze_credit",
        "description": "Pull and analyze credit report, payment history, and debt obligations.",
        "input_schema": {
            "type": "object",
            "properties": {
                "applicant_name": {"type": "string"},
                "annual_income": {"type": "string"},
                "loan_amount": {"type": "string"}
            },
            "required": ["applicant_name", "annual_income", "loan_amount"]
        }
    },
    {
        "name": "assess_risk",
        "description": "Calculate risk score, debt-to-income ratio, and loan eligibility.",
        "input_schema": {
            "type": "object",
            "properties": {
                "credit_analysis": {"type": "object"},
                "loan_amount": {"type": "string"},
                "loan_purpose": {"type": "string"}
            },
            "required": ["credit_analysis", "loan_amount", "loan_purpose"]
        }
    },
    {
        "name": "prepare_application",
        "description": "Compile complete loan application package with all required financial documentation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "applicant_data": {"type": "object"},
                "risk_assessment": {"type": "object"},
                "lender": {"type": "string"}
            },
            "required": ["applicant_data", "risk_assessment", "lender"]
        }
    },
    {
        "name": "submit_to_lender",
        "description": "Submit the complete loan application to the selected lender for underwriting review.",
        "input_schema": {
            "type": "object",
            "properties": {
                "application_id": {"type": "string"},
                "lender": {"type": "string"},
                "loan_type": {"type": "string"}
            },
            "required": ["application_id", "lender", "loan_type"]
        }
    }
]

STEP_DISPLAY = {
    "verify_identity":    ("Verifying Identity",         "Running KYC checks and fraud screening",                      "Identity verified — no fraud flags detected"),
    "analyze_credit":     ("Analyzing Credit Profile",   "Pulling credit report and evaluating payment history",         "Credit analyzed — score and history reviewed"),
    "assess_risk":        ("Assessing Risk",             "Calculating DTI ratio and loan eligibility",                   "Risk assessed — application eligible to proceed"),
    "prepare_application":("Preparing Application",      "Compiling complete loan package with all documentation",       "Application package prepared — all docs included"),
    "submit_to_lender":   ("Submitting to Lender",       "Transmitting application to underwriting department",          "Application submitted — reference number assigned"),
}

FORM_FIELDS = [
    {"key": "applicant_name",   "label": "Full Legal Name",      "type": "text",     "required": True,  "placeholder": "e.g. Robert J. Martinez"},
    {"key": "date_of_birth",    "label": "Date of Birth",        "type": "date",     "required": True,  "placeholder": ""},
    {"key": "ssn_last4",        "label": "SSN Last 4 Digits",    "type": "text",     "required": True,  "placeholder": "e.g. 4521"},
    {"key": "annual_income",    "label": "Annual Income",        "type": "text",     "required": True,  "placeholder": "e.g. $85,000"},
    {"key": "employer",         "label": "Employer",             "type": "text",     "required": True,  "placeholder": "e.g. Acme Corp"},
    {"key": "loan_amount",      "label": "Loan Amount",          "type": "text",     "required": True,  "placeholder": "e.g. $250,000"},
    {"key": "loan_purpose",     "label": "Loan Purpose",         "type": "select",   "required": True,  "options": ["Home Purchase","Refinance","Business Expansion","Equipment","Auto","Personal","Student","Debt Consolidation"]},
    {"key": "lender",           "label": "Preferred Lender",     "type": "select",   "required": True,  "options": ["Wells Fargo","Chase","Bank of America","Citibank","US Bank","SBA","Local Credit Union"]},
    {"key": "loan_description", "label": "Purpose Description",  "type": "textarea", "required": True,  "placeholder": "Describe how the funds will be used..."},
]

DEMO_DATA = {
    "applicant_name": "Robert J. Martinez",
    "date_of_birth": "1982-07-23",
    "ssn_last4": "4521",
    "annual_income": "$95,000",
    "employer": "TechVentures LLC",
    "loan_amount": "$250,000",
    "loan_purpose": "Business Expansion",
    "lender": "Wells Fargo",
    "loan_description": "Expanding our SaaS platform to serve enterprise clients. Funds will be used for infrastructure scaling, hiring 3 engineers, and 12-month operating runway.",
}


async def execute_tool(tool_name: str, tool_input: dict) -> dict:
    import asyncio
    await asyncio.sleep(0.7)

    if tool_name == "verify_identity":
        return {
            "identity_verified": True,
            "kyc_status": "PASS",
            "fraud_score": 0.03,
            "watchlist_clear": True,
            "id_match_confidence": 0.97,
            "notes": "Identity confirmed across 3 data sources. No fraud indicators detected."
        }
    elif tool_name == "analyze_credit":
        return {
            "credit_score": 742,
            "credit_tier": "Good",
            "payment_history": "98% on-time payments",
            "total_debt": "$42,000",
            "available_credit": "$85,000",
            "derogatory_marks": 0,
            "credit_age_years": 12,
            "notes": "Strong credit profile. Qualifies for prime lending rates."
        }
    elif tool_name == "assess_risk":
        return {
            "risk_score": 0.18,
            "risk_tier": "Low",
            "dti_ratio": "28%",
            "max_loan_eligible": "$320,000",
            "recommended_rate": "6.85%",
            "eligible": True,
            "notes": "DTI within acceptable range. Loan amount well within eligibility ceiling."
        }
    elif tool_name == "prepare_application":
        app_id = f"APP-{uuid.uuid4().hex[:8].upper()}"
        return {
            "application_id": app_id,
            "completeness_score": 0.97,
            "documents_included": ["Loan application", "Credit authorization", "Income verification", "Business financials", "Purpose statement"],
            "missing_items": [],
            "notes": "Complete application package ready for submission."
        }
    elif tool_name == "submit_to_lender":
        lender = tool_input.get("lender", "Bank")
        codes = {"Wells Fargo": "WF", "Chase": "JPM", "Bank of America": "BOA", "Citibank": "CITI", "US Bank": "USB", "SBA": "SBA"}
        code = codes.get(lender, "LND")
        ref = f"{code}-{datetime.utcnow().year}-LN-{uuid.uuid4().int % 900000 + 100000}"
        return {
            "reference_number": ref,
            "confirmation_number": ref,
            "submitted_at": datetime.utcnow().isoformat(),
            "expected_response_by": (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "current_status": "In Underwriting Review",
            "assigned_officer": "Underwriting Team"
        }
    return {"error": f"Unknown tool: {tool_name}"}
