import asyncio
import json
import os
from datetime import datetime
from typing import Callable

from google import genai
from google.genai import types

from models import AuthRequest, AgentStep, StepStatus
from agent import execute_tool, TOOL_DISPLAY_NAMES, TOOL_MESSAGES, SYSTEM_PROMPT

_client = None

def get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))
    return _client


GEMINI_TOOLS = [
    types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="scan_insurance_policy",
            description="Scan and retrieve the insurance policy requirements for a specific treatment type.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "insurance_provider": types.Schema(type=types.Type.STRING, description="Name of the insurance provider"),
                    "treatment_type": types.Schema(type=types.Type.STRING, description="Type of treatment requiring authorization"),
                },
                required=["insurance_provider", "treatment_type"]
            )
        ),
        types.FunctionDeclaration(
            name="analyze_medical_records",
            description="Analyze patient medical records to find supporting documentation.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "patient_id": types.Schema(type=types.Type.STRING, description="Patient's unique identifier"),
                    "diagnosis_code": types.Schema(type=types.Type.STRING, description="ICD-10 diagnosis code"),
                    "treatment_type": types.Schema(type=types.Type.STRING, description="Type of treatment being requested"),
                },
                required=["patient_id", "diagnosis_code", "treatment_type"]
            )
        ),
        types.FunctionDeclaration(
            name="fill_authorization_form",
            description="Fill out the prior authorization form with all required information.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "auth_request": types.Schema(type=types.Type.OBJECT, description="The original authorization request data"),
                    "policy_requirements": types.Schema(type=types.Type.OBJECT, description="Requirements from scan_insurance_policy"),
                    "medical_analysis": types.Schema(type=types.Type.OBJECT, description="Analysis from analyze_medical_records"),
                },
                required=["auth_request", "policy_requirements", "medical_analysis"]
            )
        ),
        types.FunctionDeclaration(
            name="submit_authorization",
            description="Submit the completed authorization form to the insurance company.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "form_id": types.Schema(type=types.Type.STRING, description="ID of the completed form"),
                    "insurance_provider": types.Schema(type=types.Type.STRING, description="Name of the insurance provider"),
                    "submission_method": types.Schema(type=types.Type.STRING, description="Method of submission"),
                },
                required=["form_id", "insurance_provider", "submission_method"]
            )
        ),
        types.FunctionDeclaration(
            name="track_authorization_status",
            description="Set up tracking and get initial status for the submitted authorization.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "submission_id": types.Schema(type=types.Type.STRING, description="ID from submit_authorization"),
                    "insurance_provider": types.Schema(type=types.Type.STRING, description="Name of the insurance provider"),
                },
                required=["submission_id", "insurance_provider"]
            )
        ),
    ])
]


async def run_prior_auth_agent_gemini(auth_request: AuthRequest, callback: Callable) -> str:
    client = get_client()

    user_message = f"""Process a prior authorization request with the following details:

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

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=GEMINI_TOOLS,
    )

    messages = [types.Content(role="user", parts=[types.Part(text=user_message)])]

    while True:
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.models.generate_content(
                model="gemini-2.0-flash",
                contents=messages,
                config=config,
            )
        )

        # Add assistant response to history
        messages.append(response.candidates[0].content)

        # Collect function calls
        fn_calls = [
            part.function_call
            for part in response.candidates[0].content.parts
            if part.function_call is not None
        ]

        if not fn_calls:
            # No more tool calls — return final text
            final_text = ""
            for part in response.candidates[0].content.parts:
                if hasattr(part, "text") and part.text:
                    final_text += part.text
            return final_text or "Authorization processing complete."

        # Execute each tool call and build function response parts
        fn_response_parts = []
        for fn_call in fn_calls:
            tool_name = fn_call.name
            tool_input = dict(fn_call.args)

            running_step = AgentStep(
                tool_name=TOOL_DISPLAY_NAMES.get(tool_name, tool_name),
                status=StepStatus.running,
                message=TOOL_MESSAGES.get(tool_name, {}).get("running", "Processing..."),
                timestamp=datetime.utcnow().isoformat()
            )
            await callback(running_step)

            result = await execute_tool(tool_name, tool_input)

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

            fn_response_parts.append(
                types.Part(
                    function_response=types.FunctionResponse(
                        name=tool_name,
                        response={"result": json.dumps(result)}
                    )
                )
            )

        # Add tool results to conversation
        messages.append(types.Content(role="user", parts=fn_response_parts))
