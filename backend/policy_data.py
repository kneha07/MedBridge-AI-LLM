"""Synthetic payer policy table (extracted from the legacy agent.py so rag/store.py can import it)."""

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

