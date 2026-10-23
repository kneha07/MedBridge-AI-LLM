import asyncio
import json
import os
from datetime import datetime
from typing import Callable

from groq import Groq

from models import AuthRequest, AgentStep, StepStatus
from agent import execute_tool, TOOL_DISPLAY_NAMES, TOOL_MESSAGES, TOOLS

GROQ_SYSTEM_PROMPT = """You are MedBridge, an AI agent for healthcare prior authorizations.
Complete all 5 steps in order: scan policy, analyze records, fill form, submit, track status.
After all tools are done, provide a brief 3-4 sentence summary with the confirmation number and expected timeline."""

_client = None

def get_client():
    global _client
    if _client is None:
        _client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
    return _client

# Convert Claude tool format to OpenAI/Groq format
GROQ_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": t["name"],
            "description": t["description"],
            "parameters": t["input_schema"]
        }
    }
    for t in TOOLS
]


async def run_prior_auth_agent_groq(auth_request: AuthRequest, callback: Callable) -> str:
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

    messages = [
        {"role": "system", "content": GROQ_SYSTEM_PROMPT},
        {"role": "user", "content": user_message}
    ]

    while True:
        for attempt in range(3):
            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: client.chat.completions.create(
                        model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
                        messages=messages,
                        tools=GROQ_TOOLS,
                        tool_choice="auto",
                        max_tokens=2048,
                    )
                )
                break
            except Exception as e:
                if "rate_limit" in str(e).lower() and attempt < 2:
                    await asyncio.sleep(15)
                else:
                    raise

        msg = response.choices[0].message
        messages.append({"role": "assistant", "content": msg.content, "tool_calls": msg.tool_calls})

        if not msg.tool_calls:
            return msg.content or "Authorization processing complete."

        for tool_call in msg.tool_calls:
            tool_name = tool_call.function.name
            tool_input = json.loads(tool_call.function.arguments)

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

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result)
            })
