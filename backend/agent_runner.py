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
    """Anthropic SDK client: first-party, or Amazon Bedrock through the standard bedrock-runtime endpoint.

    Bedrock reads the key from AWS_BEARER_TOKEN_BEDROCK (or standard AWS credentials) and the region from AWS_REGION.
    """
    global _anthropic_client, _bedrock_client
    if provider == "bedrock":
        if _bedrock_client is None:
            _bedrock_client = anthropic.AnthropicBedrock(aws_region=os.environ.get("AWS_REGION", "us-east-1"))
        return _bedrock_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
    return _anthropic_client


def claude_model(provider: str = "claude") -> str:
    """Model ID. Bedrock: BEDROCK_MODEL_ID (an inference profile ID such as us.anthropic.claude-sonnet-4-6; see Infer > Inference profiles in the Bedrock console).
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


UI_ONLY_KEYS = ("fhir_bundle", "fhir_claim_response", "timeline")  # shown in the UI, not needed by the model


def for_model(result: dict) -> dict:
    """The tool result the model sees: without the large FHIR payloads, which only the UI displays."""
    return {k: v for k, v in result.items() if k not in UI_ONLY_KEYS}


MAX_NUDGES = 2  # times the runner asks the model to continue when it stops before the required steps are done


class SequenceGuard:
    """Enforces the vertical's tool order in code instead of relying on the prompt.

    A tool called before its prerequisites, or a run-once tool called again, is not executed: the model gets an
    error result naming the step to call instead. Verticals without TOOL_ORDER are not constrained.
    """

    def __init__(self, vertical, on_event: Callable | None = None):
        self.on_event = on_event or (lambda event: None)  # refusals, nudges and an unfinished end, for the UI and audit
        self.order = tuple(getattr(vertical, "TOOL_ORDER", ()))
        self.run_once = set(getattr(vertical, "RUN_ONCE", ()))
        self.conditional = getattr(vertical, "conditional_tools", lambda results: ())
        self.gated = set(getattr(vertical, "CONDITIONAL_TOOLS", ()))  # may run only when conditional_tools asks
        self.results: dict = {}
        self.refusals = 0

    def required(self) -> tuple:
        return self.order + tuple(self.conditional(self.results)) if self.order else ()

    def missing(self) -> list[str]:
        return [t for t in self.required() if t not in self.results]

    def check(self, tool_name: str) -> str | None:
        """None if the tool may run now, otherwise the reason it may not."""
        if not self.order:
            return None
        if tool_name in self.run_once and tool_name in self.results:
            return f"{tool_name} has already run in this request and must not run again."
        required = self.required()
        if tool_name in required:
            before = [t for t in required[:required.index(tool_name)] if t not in self.results]
            if before:
                return f"Out of order: call {before[0]} before {tool_name}."
        elif tool_name in self.gated:
            return f"{tool_name} is not applicable: no result so far calls for it."
        return None

    def record(self, tool_name: str, result: dict):
        self.results[tool_name] = result

    def refuse(self, reason: str, tool_name: str = "") -> dict:
        self.refusals += 1
        nxt = (self.missing() or [None])[0]
        self.on_event({"kind": "refused", "tool": tool_name, "reason": reason, "next": nxt})
        return {"error": reason, "next_required_step": nxt}

    def nudge(self) -> str:
        self.on_event({"kind": "nudged", "missing": self.missing()})
        return (f"The request is not finished. Still required, in order: {', '.join(self.missing())}. "
                f"Call {self.missing()[0]} now.")


def _save_stats(stats: dict | None, guard: SequenceGuard, nudges: int):
    if guard.missing():
        guard.on_event({"kind": "incomplete", "missing": guard.missing()})
    if stats is not None:
        stats.update(refused_calls=guard.refusals, nudges=nudges, missing_steps=guard.missing())


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

        for key in UI_ONLY_KEYS:  # structured payloads for the UI's FHIR viewer
            if result and result.get(key):
                summary[key] = result[key]

        if result and result.get("policy_evidence"):
            summary["policy_passages"] = [{"source": e["source"], "url": e.get("url", ""), "passage": e["passage"][:1200]}
                                          for e in result["policy_evidence"]]

        await callback(AgentStep(
            tool_name=display_name,
            status=StepStatus.done,
            message=done_msg,
            timestamp=datetime.utcnow().isoformat(),
            data=summary
        ))


async def run_agent_claude(vertical_id: str, form_data: dict, callback: Callable, gate: Callable | None = None,
                           provider: str = "claude", stats: dict | None = None, on_guard: Callable | None = None) -> str:
    vertical = get_vertical(vertical_id)
    guard, nudges = SequenceGuard(vertical, on_guard), 0
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
                reason = guard.check(tu.name)
                if reason:
                    tool_results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                         "content": json.dumps(guard.refuse(reason, tu.name))})
                    continue
                if gate and tu.name in getattr(vertical, "APPROVAL_REQUIRED", ()) and not await gate(tu.name):
                    return REJECTED_MESSAGE
                await _fire_callback(tu.name, "running", vertical, None, callback)
                result = await vertical.execute_tool(tu.name, tu.input)
                guard.record(tu.name, result)
                await _fire_callback(tu.name, "done", vertical, result, callback)
                tool_results.append({"type": "tool_result", "tool_use_id": tu.id, "content": json.dumps(for_model(result))})

            messages.append({"role": "user", "content": tool_results})

        elif response.stop_reason == "end_turn" and guard.missing() and nudges < MAX_NUDGES:
            nudges += 1
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": guard.nudge()})
        else:
            _save_stats(stats, guard, nudges)
            if response.stop_reason == "end_turn":
                return "".join(b.text for b in response.content if hasattr(b, "text"))
            return f"Completed: {response.stop_reason}"


async def run_agent_groq(vertical_id: str, form_data: dict, callback: Callable, gate: Callable | None = None,
                         stats: dict | None = None, on_guard: Callable | None = None) -> str:
    vertical = get_vertical(vertical_id)
    guard, nudges = SequenceGuard(vertical, on_guard), 0
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
            if guard.missing() and nudges < MAX_NUDGES:
                nudges += 1
                messages.append({"role": "user", "content": guard.nudge()})
                continue
            _save_stats(stats, guard, nudges)
            return msg.content or "Processing complete."

        for tc in msg.tool_calls:
            tool_name = tc.function.name
            tool_input = json.loads(tc.function.arguments or "{}")

            reason = guard.check(tool_name)
            if reason:
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(guard.refuse(reason, tool_name))})
                continue
            if gate and tool_name in getattr(vertical, "APPROVAL_REQUIRED", ()) and not await gate(tool_name):
                return REJECTED_MESSAGE
            await _fire_callback(tool_name, "running", vertical, None, callback)
            result = await vertical.execute_tool(tool_name, tool_input)
            guard.record(tool_name, result)
            await _fire_callback(tool_name, "done", vertical, result, callback)

            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(for_model(result))})


async def run_agent(vertical_id: str, ai_provider: str, form_data: dict, callback: Callable,
                    gate: Callable | None = None, stats: dict | None = None, on_guard: Callable | None = None) -> str:
    """Runs the agent. If `stats` is a dict, it receives the guard's counts (refused calls, nudges, missing steps);
    `on_guard(event)` is called at each refusal, nudge, and when a run ends with steps missing."""
    ai_provider = os.environ.get("AI_PROVIDER") or ai_provider  # lets .env switch provider without a UI change
    if ai_provider == "groq":
        return await run_agent_groq(vertical_id, form_data, callback, gate, stats, on_guard)
    return await run_agent_claude(vertical_id, form_data, callback, gate, provider=ai_provider, stats=stats, on_guard=on_guard)
