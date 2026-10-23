"""Agent trajectory evaluation (needs a provider API key, e.g. GROQ_API_KEY in ../.env).

Run from backend/:  python -m eval.agent_eval --provider groq --runs 5
Checks per run: expected tool sequence (the human-approval gate auto-approves here), no tool
errors, and, for the denial scenario, that the appeal cites a retrieved policy document.
"""
import argparse
import asyncio
import json
from collections import Counter

from dotenv import load_dotenv

load_dotenv("../.env")

from agent_runner import run_agent
from verticals import healthcare
from verticals.healthcare import DEMO_DATA

BASE = ["Scanning Insurance Policy", "Analyzing Medical Records", "Completing Authorization Form",
        "Submitting to Payer Portal", "Tracking Authorization"]
SCENARIOS = {
    "Standard Approval": BASE,
    "Denial + Auto-Appeal": BASE + ["Drafting Appeal Letter"],
}


async def one_run(provider: str, scenario: str) -> dict:
    steps = []

    async def cb(step):
        if step.status.value == "done":
            steps.append(step.tool_name)

    form = {**DEMO_DATA, "demo_scenario": scenario}
    async def auto_approve(_tool):
        return True

    try:
        await run_agent("healthcare", provider, form, cb, auto_approve)
        err = None
    except Exception as e:  # rate limits, malformed tool calls, ...
        err = str(e)[:120]
    return {"ok_sequence": steps == SCENARIOS[scenario], "steps": steps, "error": err}


async def appeal_cites_policy() -> dict:
    """draft_appeal should cite a retrieved policy document, not an invented one."""
    r = await healthcare.execute_tool("draft_appeal", {"patient_name": "Test Patient", "treatment_type": "MRI",
                                                       "insurance_provider": "Aetna"})
    return {"cited": bool(r.get("policy_citations")), "citations": r.get("policy_citations")}


async def main(provider: str, runs: int):
    summary = {}
    for scenario in SCENARIOS:
        results = [await one_run(provider, scenario) for _ in range(runs)]
        summary[scenario] = {
            "success_rate": sum(r["ok_sequence"] for r in results) / runs,
            "errors": sum(r["error"] is not None for r in results),
            "sequences": Counter(" > ".join(r["steps"]) for r in results).most_common(3),
        }
    summary["appeal_citation_check"] = await appeal_cites_policy()
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", default="groq")
    ap.add_argument("--runs", type=int, default=5)
    a = ap.parse_args()
    asyncio.run(main(a.provider, a.runs))
