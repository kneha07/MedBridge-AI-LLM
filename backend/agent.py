import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Callable, Any
import anthropic
import os

from models import AuthRequest, AgentStep, StepStatus

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

TOOLS = [
    {
        "name": "scan_insurance_policy",
        "description": "Scan and retrieve the insurance policy requirements for a specific treatment type. Returns coverage requirements, required documents, and clinical criteria.",
        "input_schema": {
            "type": "object",
            "properties": {
                "insurance_provider": {
                    "type": "string",
                    "description": "Name of the insurance provider (e.g., Aetna, Blue Cross Blue Shield)"
                },
                "treatment_type": {
                    "type": "string",
                    "description": "Type of treatment requiring authorization (e.g., MRI, Surgery, Physical Therapy)"
                }
            },
            "required": ["insurance_provider", "treatment_type"]
        }
    },
    {
        "name": "analyze_medical_records",
        "description": "Analyze patient medical records to find supporting documentation for the authorization request.",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "string",
                    "description": "Patient's unique identifier"
                },
                "diagnosis_code": {
                    "type": "string",
                    "description": "ICD-10 diagnosis code"
                },
                "treatment_type": {
                    "type": "string",
                    "description": "Type of treatment being requested"
                }
            },
            "required": ["patient_id", "diagnosis_code", "treatment_type"]
        }
    },
    {
        "name": "fill_authorization_form",
        "description": "Fill out the prior authorization form with all required information based on policy requirements and medical analysis.",
        "input_schema": {
            "type": "object",
            "properties": {
                "auth_request": {
                    "type": "object",
                    "description": "The original authorization request data"
                },
                "policy_requirements": {
                    "type": "object",
                    "description": "Requirements returned from scan_insurance_policy"
                },
                "medical_analysis": {
                    "type": "object",
                    "description": "Analysis returned from analyze_medical_records"
                }
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
                "form_id": {
                    "type": "string",
                    "description": "ID of the completed form to submit"
                },
                "insurance_provider": {
                    "type": "string",
                    "description": "Name of the insurance provider"
                },
                "submission_method": {
                    "type": "string",
                    "description": "Method of submission (e.g., electronic, fax, portal)"
                }
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
                "submission_id": {
                    "type": "string",
                    "description": "ID returned from submit_authorization"
                },
                "insurance_provider": {
                    "type": "string",
                    "description": "Name of the insurance provider"
                }
            },
            "required": ["submission_id", "insurance_provider"]
        }
    }
]

POLICY_DATA = {
    "Aetna": {
        "MRI": {
            "prior_auth_required": True,
            "coverage_requirements": [
                "Must demonstrate medical necessity with clinical documentation",
                "Conservative treatment failed for minimum 6 weeks",
                "Ordering physician must be in-network or have referral authorization",
                "Facility must be Aetna-contracted imaging center"
            ],
            "required_documents": [
                "Completed Aetna PA form (AET-IMG-2024)",
                "Physician letter of medical necessity",
                "Recent office visit notes (within 90 days)",
                "Documentation of failed conservative treatment",
                "Relevant lab results or prior imaging reports"
            ],
            "typical_approval_time": "2-5 business days (standard), 24-72 hours (urgent)",
            "clinical_criteria": [
                "Persistent symptoms unresponsive to conservative care ≥6 weeks",
                "Neurological deficits present",
                "Trauma with suspected structural injury",
                "Ruling out malignancy or infection"
            ]
        },
        "CT Scan": {
            "prior_auth_required": True,
            "coverage_requirements": [
                "Clinical indication must be documented",
                "X-ray or lower-cost imaging performed first when clinically appropriate",
                "Radiologist consultation recommended"
            ],
            "required_documents": [
                "Physician order with clinical indication",
                "Prior imaging results (if applicable)",
                "Office visit notes documenting symptoms"
            ],
            "typical_approval_time": "1-3 business days",
            "clinical_criteria": [
                "Acute injury with suspected fracture",
                "Oncology staging or follow-up",
                "Vascular assessment",
                "Abdominal pain with suspected pathology"
            ]
        },
        "Physical Therapy": {
            "prior_auth_required": True,
            "coverage_requirements": [
                "Physician referral required",
                "Treatment plan must be submitted with initial request",
                "Maximum 20 visits per benefit year without additional review"
            ],
            "required_documents": [
                "Physician referral",
                "PT evaluation and treatment plan",
                "Functional assessment scores"
            ],
            "typical_approval_time": "1-2 business days",
            "clinical_criteria": [
                "Post-surgical rehabilitation",
                "Musculoskeletal condition impacting function",
                "Neurological condition requiring skilled PT"
            ]
        }
    },
    "Blue Cross Blue Shield": {
        "MRI": {
            "prior_auth_required": True,
            "coverage_requirements": [
                "Medical necessity must be established",
                "Must meet BCBS clinical criteria guidelines",
                "In-network facility preferred for full coverage"
            ],
            "required_documents": [
                "BCBS PA Request Form",
                "Clinical notes supporting diagnosis",
                "Prior treatment history"
            ],
            "typical_approval_time": "3-5 business days",
            "clinical_criteria": [
                "Symptoms persisting beyond expected recovery period",
                "Clinical findings inconsistent with initial diagnosis",
                "Pre-surgical planning"
            ]
        },
        "Surgery": {
            "prior_auth_required": True,
            "coverage_requirements": [
                "Second surgical opinion may be required for elective procedures",
                "Conservative treatment documented and failed",
                "Board-certified surgeon required"
            ],
            "required_documents": [
                "Surgical PA request with CPT codes",
                "Operative plan",
                "Failed conservative treatment documentation",
                "Specialist consultation notes"
            ],
            "typical_approval_time": "5-10 business days",
            "clinical_criteria": [
                "Conservative management failed ≥12 weeks",
                "Significant functional impairment documented",
                "Surgical risk acceptable per pre-op evaluation"
            ]
        }
    },
    "United Healthcare": {
        "MRI": {
            "prior_auth_required": True,
            "coverage_requirements": [
                "Ordering provider must submit via UHC portal or phone",
                "Clinical peer-to-peer available if denied",
                "Advanced imaging requires RadMD review"
            ],
            "required_documents": [
                "UHC Advanced Imaging Request",
                "Clinical documentation",
                "Previous treatment records"
            ],
            "typical_approval_time": "2-4 business days",
            "clinical_criteria": [
                "Acute neurological symptoms",
                "Failed conservative therapy",
                "Cancer screening or staging"
            ]
        }
    },
    "Cigna": {
        "MRI": {
            "prior_auth_required": True,
            "coverage_requirements": [
                "eviCore healthcare manages imaging PA for Cigna",
                "Submit via eviCore portal with clinical info",
                "Real-time decisions often available online"
            ],
            "required_documents": [
                "eviCore request with clinical details",
                "Physician notes",
                "Symptom duration and severity documentation"
            ],
            "typical_approval_time": "Same day (online) to 3 business days",
            "clinical_criteria": [
                "Clinical presentation requiring advanced imaging",
                "Inadequate response to initial treatment",
                "Diagnostic uncertainty requiring further workup"
            ]
        }
    },
    "Humana": {
        "MRI": {
            "prior_auth_required": True,
            "coverage_requirements": [
                "UM review conducted by clinical staff",
                "Humana Gold Plus and PPO have different requirements",
                "Emergency MRIs may be exempt from pre-auth"
            ],
            "required_documents": [
                "Humana PA form",
                "Clinical justification letter",
                "Supporting diagnostic results"
            ],
            "typical_approval_time": "3-5 business days",
            "clinical_criteria": [
                "Medically necessary per Humana clinical guidelines",
                "Not considered experimental or investigational"
            ]
        }
    },
    "Medicare": {
        "MRI": {
            "prior_auth_required": False,
            "coverage_requirements": [
                "Generally covered without PA under Medicare Part B",
                "Must be medically necessary",
                "Provider must accept Medicare assignment"
            ],
            "required_documents": [
                "Physician order",
                "Clinical indication in medical record"
            ],
            "typical_approval_time": "N/A - No PA required",
            "clinical_criteria": [
                "Medically necessary per Medicare coverage guidelines",
                "Ordered by treating physician"
            ]
        }
    },
    "Medicaid": {
        "MRI": {
            "prior_auth_required": True,
            "coverage_requirements": [
                "State Medicaid program requirements vary",
                "Managed care plan rules apply if enrolled in MCO",
                "Must use Medicaid-enrolled facility"
            ],
            "required_documents": [
                "State PA form",
                "Medical necessity documentation",
                "Medicaid eligibility verification"
            ],
            "typical_approval_time": "3-7 business days",
            "clinical_criteria": [
                "Medical necessity per state Medicaid guidelines",
                "Not available through less costly alternative"
            ]
        }
    }
}

PATIENT_RECORDS = {
    "default": {
        "M72.5": {
            "MRI": {
                "relevant_history": [
                    "Patient presents with 8-week history of lower back pain radiating to left leg",
                    "Initial treatment: NSAIDs (ibuprofen 600mg TID x 6 weeks) — inadequate relief",
                    "Chiropractic care x 8 sessions — minimal improvement reported",
                    "Physical therapy evaluation completed 2 weeks ago — functional limitation noted",
                    "VAS pain score: 7/10 at rest, 9/10 with activity"
                ],
                "supporting_diagnoses": [
                    "M72.5 - Plantar fascial fibromatosis (primary)",
                    "M54.4 - Lumbago with sciatica, left side (secondary)",
                    "M51.16 - Intervertebral disc degeneration, lumbar region (suspected)"
                ],
                "contraindications": [
                    "No known claustrophobia",
                    "No metallic implants",
                    "No prior contrast reaction on file"
                ],
                "medical_necessity_score": 0.87,
                "notes": "Patient demonstrates clear medical necessity with documented failed conservative care. Radicular symptoms suggest possible disc herniation requiring MRI for definitive diagnosis and surgical planning if indicated."
            }
        },
        "G43.909": {
            "MRI": {
                "relevant_history": [
                    "Chronic migraine disorder, 3+ years duration",
                    "Frequency increased to 15+ days/month in past 6 months",
                    "Tried multiple preventive medications: topiramate, amitriptyline — inadequate response",
                    "Recent neurological exam: normal except for mild photophobia",
                    "Family history of intracranial aneurysm (mother)"
                ],
                "supporting_diagnoses": [
                    "G43.909 - Migraine, unspecified, not intractable, without status migrainosus (primary)",
                    "R51 - Headache (secondary)"
                ],
                "contraindications": [
                    "No contraindications identified",
                    "Gadolinium contrast: no prior reactions"
                ],
                "medical_necessity_score": 0.82,
                "notes": "Brain MRI warranted given chronicity, medication failure, and family history of vascular anomaly. Ruling out secondary causes of headache is clinically appropriate."
            }
        }
    }
}

PHYSICIAN_DB = {
    "1234567890": {"name": "Dr. Sarah Chen", "specialty": "Orthopedics", "network_status": "In-Network"},
    "0987654321": {"name": "Dr. James Martinez", "specialty": "Neurology", "network_status": "In-Network"},
    "1122334455": {"name": "Dr. Emily Rodriguez", "specialty": "Family Medicine", "network_status": "In-Network"},
}


def get_policy_data(insurance_provider: str, treatment_type: str) -> dict:
    provider_data = POLICY_DATA.get(insurance_provider, POLICY_DATA.get("Aetna"))
    treatment_data = provider_data.get(treatment_type, provider_data.get("MRI", {}))
    if not treatment_data:
        treatment_data = {
            "prior_auth_required": True,
            "coverage_requirements": [
                "Medical necessity documentation required",
                "Physician order required",
                "In-network provider preferred"
            ],
            "required_documents": [
                "PA request form",
                "Clinical documentation",
                "Physician notes"
            ],
            "typical_approval_time": "3-5 business days",
            "clinical_criteria": [
                "Medical necessity per payer guidelines",
                "Conservative treatment attempted when appropriate"
            ]
        }
    return treatment_data


def get_patient_records(patient_id: str, diagnosis_code: str, treatment_type: str) -> dict:
    records = PATIENT_RECORDS.get("default", {})
    diag_records = records.get(diagnosis_code, records.get("M72.5", {}))
    treatment_records = diag_records.get(treatment_type, diag_records.get("MRI", {
        "relevant_history": [
            f"Patient history available for ID {patient_id}",
            "Chronic condition with documented progression",
            "Multiple conservative treatments attempted without adequate relief"
        ],
        "supporting_diagnoses": [
            f"{diagnosis_code} - Primary diagnosis",
            "Related comorbidities documented in chart"
        ],
        "contraindications": ["No significant contraindications identified"],
        "medical_necessity_score": 0.79,
        "notes": "Medical records support authorization request. Patient demonstrates appropriate clinical indicators for requested treatment."
    }))
    return treatment_records


async def execute_tool(tool_name: str, tool_input: dict) -> dict:
    await asyncio.sleep(0.7)

    if tool_name == "scan_insurance_policy":
        insurance_provider = tool_input.get("insurance_provider", "Aetna")
        treatment_type = tool_input.get("treatment_type", "MRI")
        policy = get_policy_data(insurance_provider, treatment_type)
        return {
            "coverage_requirements": policy["coverage_requirements"],
            "required_documents": policy["required_documents"],
            "typical_approval_time": policy["typical_approval_time"],
            "prior_auth_required": policy["prior_auth_required"],
            "clinical_criteria": policy["clinical_criteria"]
        }

    elif tool_name == "analyze_medical_records":
        patient_id = tool_input.get("patient_id", "")
        diagnosis_code = tool_input.get("diagnosis_code", "")
        treatment_type = tool_input.get("treatment_type", "MRI")
        records = get_patient_records(patient_id, diagnosis_code, treatment_type)
        return {
            "relevant_history": records["relevant_history"],
            "supporting_diagnoses": records["supporting_diagnoses"],
            "contraindications": records["contraindications"],
            "medical_necessity_score": records["medical_necessity_score"],
            "notes": records["notes"]
        }

    elif tool_name == "fill_authorization_form":
        auth_request = tool_input.get("auth_request", {})
        policy_requirements = tool_input.get("policy_requirements", {})
        medical_analysis = tool_input.get("medical_analysis", {})

        form_id = f"FORM-{uuid.uuid4().hex[:8].upper()}"
        necessity_score = medical_analysis.get("medical_necessity_score", 0.8)
        missing_fields = []
        if necessity_score > 0.75:
            completeness = 0.96
        else:
            completeness = 0.88
            missing_fields = ["Additional clinical notes recommended"]

        form_data = {
            "patient_name": auth_request.get("patient_name", ""),
            "patient_dob": auth_request.get("patient_dob", ""),
            "patient_id": auth_request.get("patient_id", ""),
            "insurance_provider": auth_request.get("insurance_provider", ""),
            "insurance_id": auth_request.get("insurance_id", ""),
            "treatment_type": auth_request.get("treatment_type", ""),
            "diagnosis_code": auth_request.get("diagnosis_code", ""),
            "treatment_description": auth_request.get("treatment_description", ""),
            "requesting_physician": auth_request.get("requesting_physician", ""),
            "physician_npi": auth_request.get("physician_npi", ""),
            "urgency": auth_request.get("urgency", "routine"),
            "clinical_justification": medical_analysis.get("notes", ""),
            "supporting_diagnoses": ", ".join(medical_analysis.get("supporting_diagnoses", [])),
            "required_documents_included": policy_requirements.get("required_documents", []),
            "clinical_criteria_met": policy_requirements.get("clinical_criteria", []),
            "form_completed_at": datetime.utcnow().isoformat()
        }

        return {
            "form_id": form_id,
            "form_data": form_data,
            "completeness_score": completeness,
            "missing_fields": missing_fields
        }

    elif tool_name == "submit_authorization":
        form_id = tool_input.get("form_id", "")
        insurance_provider = tool_input.get("insurance_provider", "")
        submission_method = tool_input.get("submission_method", "electronic")

        provider_codes = {
            "Aetna": "AET",
            "Blue Cross Blue Shield": "BCBS",
            "United Healthcare": "UHC",
            "Cigna": "CGN",
            "Humana": "HUM",
            "Medicare": "MCR",
            "Medicaid": "MCD"
        }
        code = provider_codes.get(insurance_provider, "INS")
        year = datetime.utcnow().year
        num = uuid.uuid4().int % 900000 + 100000
        confirmation_number = f"{code}-{year}-PRI-{num}"
        submission_id = f"SUB-{uuid.uuid4().hex[:10].upper()}"
        submitted_at = datetime.utcnow().isoformat()
        expected_by = (datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%d")

        return {
            "submission_id": submission_id,
            "submitted_at": submitted_at,
            "expected_response_by": expected_by,
            "confirmation_number": confirmation_number
        }

    elif tool_name == "track_authorization_status":
        submission_id = tool_input.get("submission_id", "")
        insurance_provider = tool_input.get("insurance_provider", "")

        decision_date = (datetime.utcnow() + timedelta(days=3)).strftime("%Y-%m-%d")
        next_review = (datetime.utcnow() + timedelta(hours=48)).strftime("%Y-%m-%d %H:%M UTC")

        return {
            "current_status": "Under Review",
            "last_updated": datetime.utcnow().isoformat(),
            "next_action": "Clinical review by insurance medical director within 48 hours",
            "estimated_decision_date": decision_date,
            "notes": f"Authorization {submission_id} received by {insurance_provider}. Standard processing initiated. Tracking active — you will be notified of any status changes or additional information requests."
        }

    return {"error": f"Unknown tool: {tool_name}"}


TOOL_DISPLAY_NAMES = {
    "scan_insurance_policy": "Scanning Insurance Policy",
    "analyze_medical_records": "Analyzing Medical Records",
    "fill_authorization_form": "Completing Authorization Form",
    "submit_authorization": "Submitting to Insurance",
    "track_authorization_status": "Setting Up Status Tracking"
}

TOOL_MESSAGES = {
    "scan_insurance_policy": {
        "running": "Retrieving coverage requirements and clinical criteria...",
        "done": "Policy scanned — requirements and documentation checklist ready"
    },
    "analyze_medical_records": {
        "running": "Reviewing patient history and clinical documentation...",
        "done": "Medical records analyzed — necessity score calculated"
    },
    "fill_authorization_form": {
        "running": "Populating authorization form with all required fields...",
        "done": "Form completed with high completeness score"
    },
    "submit_authorization": {
        "running": "Transmitting authorization to insurance portal...",
        "done": "Authorization submitted — confirmation number assigned"
    },
    "track_authorization_status": {
        "running": "Initializing status tracking and setting up alerts...",
        "done": "Tracking active — estimated decision date set"
    }
}

SYSTEM_PROMPT = """You are MedBridge, an expert AI agent specializing in healthcare prior authorizations.
Your job is to autonomously handle the entire prior authorization process by:
1. First scanning the insurance policy to understand requirements
2. Analyzing the patient's medical records for supporting documentation
3. Filling out the authorization form completely and accurately
4. Submitting the authorization to the insurance company
5. Setting up status tracking

Be thorough and systematic. Always complete all 5 steps in order. After all tools are done, provide a clear summary of what was accomplished, the confirmation number, and the expected timeline for approval. Format your final summary in a clear, professional manner suitable for a medical office."""


async def run_prior_auth_agent(auth_request: AuthRequest, callback: Callable) -> str:
    messages = [
        {
            "role": "user",
            "content": f"""Process a prior authorization request with the following details:

Patient: {auth_request.patient_name}
Date of Birth: {auth_request.patient_dob}
Patient ID: {auth_request.patient_id}
Insurance Provider: {auth_request.insurance_provider}
Insurance ID: {auth_request.insurance_id}
Treatment Type: {auth_request.treatment_type}
Diagnosis Code (ICD-10): {auth_request.diagnosis_code}
Treatment Description: {auth_request.treatment_description}
Requesting Physician: {auth_request.requesting_physician}
Physician NPI: {auth_request.physician_npi}
Urgency: {auth_request.urgency}

Please complete all 5 steps of the prior authorization process now."""
        }
    ]

    tool_results_accumulator = {}

    while True:
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages
            )
        )

        if response.stop_reason == "tool_use":
            tool_uses = [block for block in response.content if block.type == "tool_use"]
            tool_results = []

            messages.append({"role": "assistant", "content": response.content})

            for tool_use in tool_uses:
                tool_name = tool_use.name
                tool_input = tool_use.input

                running_step = AgentStep(
                    tool_name=TOOL_DISPLAY_NAMES.get(tool_name, tool_name),
                    status=StepStatus.running,
                    message=TOOL_MESSAGES.get(tool_name, {}).get("running", "Processing..."),
                    timestamp=datetime.utcnow().isoformat()
                )
                await callback(running_step)

                result = await execute_tool(tool_name, tool_input)
                tool_results_accumulator[tool_name] = result

                summary_data = {}
                if tool_name == "scan_insurance_policy":
                    summary_data = {
                        "prior_auth_required": result.get("prior_auth_required"),
                        "approval_time": result.get("typical_approval_time"),
                        "documents_needed": len(result.get("required_documents", []))
                    }
                elif tool_name == "analyze_medical_records":
                    summary_data = {
                        "necessity_score": result.get("medical_necessity_score"),
                        "supporting_diagnoses": len(result.get("supporting_diagnoses", []))
                    }
                elif tool_name == "fill_authorization_form":
                    summary_data = {
                        "form_id": result.get("form_id"),
                        "completeness_score": result.get("completeness_score")
                    }
                elif tool_name == "submit_authorization":
                    summary_data = {
                        "confirmation_number": result.get("confirmation_number"),
                        "expected_by": result.get("expected_response_by")
                    }
                elif tool_name == "track_authorization_status":
                    summary_data = {
                        "status": result.get("current_status"),
                        "decision_date": result.get("estimated_decision_date")
                    }

                done_step = AgentStep(
                    tool_name=TOOL_DISPLAY_NAMES.get(tool_name, tool_name),
                    status=StepStatus.done,
                    message=TOOL_MESSAGES.get(tool_name, {}).get("done", "Complete"),
                    timestamp=datetime.utcnow().isoformat(),
                    data=summary_data
                )
                await callback(done_step)

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": json.dumps(result)
                })

            messages.append({"role": "user", "content": tool_results})

        elif response.stop_reason == "end_turn":
            final_text = ""
            for block in response.content:
                if hasattr(block, "text"):
                    final_text += block.text
            return final_text

        else:
            return f"Agent completed with stop reason: {response.stop_reason}"
