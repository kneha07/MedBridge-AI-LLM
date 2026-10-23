"""Generic agent runner — works with any vertical."""
import asyncio
import json
import os
from datetime import datetime
from typing import Callable

import anthropic
from groq import Groq

from models import AgentStep, StepStatus
from verticals.registry import get_vertical

REJECTED_MESSAGE = "Not submitted: the reviewer rejected this request."

_anthropic_client = None
_bedrock_client = None
_groq_client = None

def get_anthropic(provider: str = "claude"):
    """Anthropic SDK client: first-party, or Amazon Bedrock through the Messages-API ("Mantle") endpoint.

    Bedrock reads the key from AWS_BEARER_TOKEN_BEDROCK (or standard AWS credentials) and the region from AWS_REGION.
    """
    global _anthropic_client, _bedrock_client
    if provider == "bedrock":
        if _bedrock_client is None:
            _bedrock_client = anthropic.AnthropicBedrockMantle(aws_region=os.environ.get("AWS_REGION", "us-east-1"))
        return _bedrock_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
    return _anthropic_client


def claude_model(provider: str = "claude") -> str:
    """Model ID. Bedrock: BEDROCK_MODEL_ID (e.g. anthropic.claude-haiku-5-5; copy it from the Bedrock catalog).
    Claude through the Anthropic API: CLAUDE_MODEL (default claude-sonnet-5-5)."""
    if provider == "bedrock":
        return os.environ["BEDROCK_MODEL_ID"]
    return os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")


def get_groq():
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
    return _groq_client


def build_user_message(vertical_id: str, form_data: dict) -> str:
    v = get_vertical(vertical_id)
    fields = "\n".join(f"{f['label']}: {form_data.get(f['key'], 'N/A')}" for f in v.FORM_FIELDS)
    scenario = form_data.get("demo_scenario", "")
    scenario_note = "\n\nIMPORTANT: The demo scenario is 'Denial + Auto-Appeal'. The track_authorization_status tool will return a DENIAL. You MUST immediately call draft_appeal after receiving the denial." if scenario == "Denial + Auto-Appeal" else ""
    return f"Process the following {v.VERTICAL_NAME} request:\n\n{fields}{scenario_note}\n\nComplete all steps now."


async def _fire_callback(tool_name: str, status: str, vertical, result: dict | None, callback: Callable):
    display = vertical.STEP_DISPLAY.get(tool_name, (tool_name, "Processing...", "Complete"))
    display_name, running_msg, done_msg = display

    if status == "running":
        await callback(AgentStep(
            tool_name=display_name,
            status=StepStatus.running,
            message=running_msg,
            timestamp=datetime.utcnow().isoformat()
        ))
    else:
        summary = {}
        if result and result.get("policy_evidence"):
            summary["policy_sources"] = "; ".join(dict.fromkeys(e["source"] for e in result["policy_evidence"]))
        if result:
            # Pull the most interesting 3-4 keys for display
            for k, v in result.items():
                if isinstance(v, (str, int, float, bool)) and not k.endswith("_at") and k != "notes":
                    summary[k] = v
                if len(summary) >= 5:
                    break

        await callback(AgentStep(
            tool_name=display_name,
            status=StepStatus.done,
            message=done_msg,
            timestamp=datetime.utcnow().isoformat(),
            data=summary
        ))


async def run_agent_claude(vertical_id: str, form_data: dict, callback: Callable, gate: Callable | None = None,
                           provider: str = "claude") -> str:
    vertical = get_vertical(vertical_id)
    if hasattr(vertical, 'set_form_data'):
        vertical.set_form_data(form_data)
    client = get_anthropic(provider)

    messages = [{"role": "user", "content": build_user_message(vertical_id, form_data)}]

    while True:
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.messages.create(
                model=claude_model(provider),
                max_tokens=8000,
                system=vertical.SYSTEM_PROMPT,
                tools=vertical.TOOLS,
                messages=messages
            )
        )

        if response.stop_reason == "tool_use":
            tool_uses = [b for b in response.content if b.type == "tool_use"]
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []

            for tu in tool_uses:
                if gate and tu.name in getattr(vertical, "APPROVAL_REQUIRED", ()) and not await gate(tu.name):
                    return REJECTED_MESSAGE
                await _fire_callback(tu.name, "running", vertical, None, callback)
                result = await vertical.execute_tool(tu.name, tu.input)
                await _fire_callback(tu.name, "done", vertical, result, callback)
                tool_results.append({"type": "tool_result", "tool_use_id": tu.id, "content": json.dumps(result)})

            messages.append({"role": "user", "content": tool_results})

        elif response.stop_reason == "end_turn":
            return "".join(b.text for b in response.content if hasattr(b, "text"))
        else:
            return f"Completed: {response.stop_reason}"


async def run_agent_groq(vertical_id: str, form_data: dict, callback: Callable, gate: Callable | None = None) -> str:
    vertical = get_vertical(vertical_id)
    if hasattr(vertical, 'set_form_data'):
        vertical.set_form_data(form_data)
    client = get_groq()

    # Convert to OpenAI-style tools
    groq_tools = [
        {"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["input_schema"]}}
        for t in vertical.TOOLS
    ]

    messages = [
        {"role": "system", "content": vertical.SYSTEM_PROMPT},
        {"role": "user", "content": build_user_message(vertical_id, form_data)}
    ]

    while True:
        for attempt in range(3):
            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: client.chat.completions.create(
                        model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
                        messages=messages,
                        tools=groq_tools,
                        tool_choice="auto",
                        max_tokens=1024,
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
            return msg.content or "Processing complete."

        for tc in msg.tool_calls:
            tool_name = tc.function.name
            tool_input = json.loads(tc.function.arguments)

            if gate and tool_name in getattr(vertical, "APPROVAL_REQUIRED", ()) and not await gate(tool_name):
                return REJECTED_MESSAGE
            await _fire_callback(tool_name, "running", vertical, None, callback)
            result = await vertical.execute_tool(tool_name, tool_input)
            await _fire_callback(tool_name, "done", vertical, result, callback)

            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})


async def run_agent(vertical_id: str, ai_provider: str, form_data: dict, callback: Callable,
                    gate: Callable | None = None) -> str:
    ai_provider = os.environ.get("AI_PROVIDER") or ai_provider  # lets .env switch provider without a UI change
    if ai_provider == "groq":
        return await run_agent_groq(vertical_id, form_data, callback, gate)
    return await run_agent_claude(vertical_id, form_data, callback, gate, provider=ai_provider)
