"""Tool-order enforcement in the agent runner (no LLM calls: the Groq client is replaced by a script)."""
import asyncio
import json
from types import SimpleNamespace

import pytest

import agent_runner
from agent_runner import SequenceGuard
from verticals import healthcare

ORDER = list(healthcare.TOOL_ORDER)


def guard_after(*tools, track_status="Under Review"):
    g = SequenceGuard(healthcare)
    for t in tools:
        g.record(t, {"current_status": track_status} if t == "track_authorization_status" else {})
    return g


def test_first_step_allowed_and_later_steps_refused():
    g = SequenceGuard(healthcare)
    assert g.check("scan_insurance_policy") is None
    assert "call scan_insurance_policy before submit_authorization" in g.check("submit_authorization")


def test_full_order_passes_and_nothing_missing_without_denial():
    g = SequenceGuard(healthcare)
    for t in ORDER:
        assert g.check(t) is None
        g.record(t, {"current_status": "Under Review"} if t == "track_authorization_status" else {})
    assert g.missing() == []


def test_submit_runs_only_once():
    g = guard_after(*ORDER[:4])
    assert "already run" in g.check("submit_authorization")


def test_appeal_refused_without_denial_and_required_after_denial():
    assert "not applicable" in guard_after(*ORDER).check("draft_appeal")
    g = guard_after(*ORDER, track_status="DENIED")
    assert g.missing() == ["draft_appeal"]
    assert g.check("draft_appeal") is None


def test_vertical_without_order_is_unconstrained():
    g = SequenceGuard(SimpleNamespace())
    assert g.check("anything") is None and g.missing() == []


# --- the Groq loop, driven by a scripted fake client -------------------------------------------------

def _call(name, i):
    return SimpleNamespace(id=f"c{i}", function=SimpleNamespace(name=name, arguments=json.dumps({})))


class FakeGroq:
    """Returns one scripted assistant turn per request: a list of tool names, or None to stop."""

    def __init__(self, script):
        self.script, self.requests = list(script), []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kw):
        self.requests.append([dict(m) if isinstance(m, dict) else m for m in kw["messages"]])
        turn = self.script.pop(0) if self.script else None
        calls = [_call(n, i) for i, n in enumerate(turn or [])] or None
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="done", tool_calls=calls))])


@pytest.fixture
def run_scripted(monkeypatch):
    executed = []

    async def fake_execute(name, _input):
        executed.append(name)
        if name == "track_authorization_status":
            denied = healthcare._current_form_data.get().get("demo_scenario") == "Denial + Auto-Appeal"
            return {"current_status": "DENIED" if denied else "Under Review"}
        return {"ok": True}

    monkeypatch.setattr(healthcare, "execute_tool", fake_execute)
    monkeypatch.delenv("AI_PROVIDER", raising=False)

    def run(script, scenario="Standard Approval"):
        fake = FakeGroq(script)
        monkeypatch.setattr(agent_runner, "get_groq", lambda: fake)
        stats = {"events": []}

        async def cb(_step):
            pass

        form = {**healthcare.DEMO_DATA, "demo_scenario": scenario}
        asyncio.run(agent_runner.run_agent("healthcare", "groq", form, cb, None, stats, on_guard=stats["events"].append))
        return executed, stats, fake

    return run


def test_out_of_order_call_is_not_executed(run_scripted):
    executed, stats, fake = run_scripted([["submit_authorization"], ORDER, None])
    assert executed[0] == "scan_insurance_policy"           # the early submit never ran
    assert executed.count("submit_authorization") == 1
    assert stats["refused_calls"] == 1
    refusal = [m for m in fake.requests[1] if isinstance(m, dict) and m.get("role") == "tool"][0]
    assert "Out of order" in refusal["content"]


def test_early_stop_is_nudged_until_steps_complete(run_scripted):
    executed, stats, fake = run_scripted([ORDER[:3], None, ORDER[3:], None])
    assert executed == ORDER
    assert stats["nudges"] == 1 and stats["missing_steps"] == []
    nudge = fake.requests[2][-1]
    assert nudge["role"] == "user" and "submit_authorization" in nudge["content"]


def test_denial_requires_appeal(run_scripted):
    executed, stats, _ = run_scripted([ORDER, None, ["draft_appeal"], None], scenario="Denial + Auto-Appeal")
    assert executed == ORDER + ["draft_appeal"]
    assert stats["nudges"] == 1


def test_gives_up_after_max_nudges(run_scripted):
    executed, stats, _ = run_scripted([ORDER[:1], None, None, None, None])
    assert executed == ORDER[:1]
    assert stats["nudges"] == agent_runner.MAX_NUDGES
    assert stats["missing_steps"] == ORDER[1:]


def test_guard_events_are_reported(run_scripted):
    _, stats, _ = run_scripted([["submit_authorization"], ORDER[:3], None, None, None])
    kinds = [e["kind"] for e in stats["events"]]
    assert kinds == ["refused", "nudged", "nudged", "incomplete"]
    refused = stats["events"][0]
    assert refused["tool"] == "submit_authorization" and refused["next"] == "scan_insurance_policy"
    assert stats["events"][-1]["missing"] == ORDER[3:]


def test_clean_run_reports_no_events(run_scripted):
    _, stats, _ = run_scripted([ORDER, None])
    assert stats["events"] == []


def test_server_records_guard_events_with_display_names(monkeypatch):
    import sqlite3
    import main
    from models import WorkflowRequest, WorkflowStatusResponse, WorkflowStatus

    monkeypatch.setattr(main.db, "_conn", sqlite3.connect(":memory:", check_same_thread=False))
    monkeypatch.setattr(main.db, "save", lambda wf: None)

    async def fake_run_agent(vertical_id, provider, form, callback, gate, stats=None, on_guard=None):
        on_guard({"kind": "refused", "tool": "submit_authorization", "next": "scan_insurance_policy",
                  "reason": "Out of order: call scan_insurance_policy before submit_authorization."})
        on_guard({"kind": "incomplete", "missing": ["track_authorization_status"]})
        return "done"

    monkeypatch.setattr(main, "run_agent", fake_run_agent)
    wid = "wf-guard-test"
    main.store[wid] = WorkflowStatusResponse(workflow_id=wid, vertical_id="healthcare", ai_provider="groq",
                                             status=WorkflowStatus.pending, created_at="t", updated_at="t")
    try:
        asyncio.run(main.process_workflow(wid, WorkflowRequest(vertical_id="healthcare", form_data={})))
        wf = main.store[wid]
        names = [healthcare.STEP_DISPLAY[t][0] for t in healthcare.TOOL_ORDER]
        assert wf.guard["order"] == names
        refused, incomplete = wf.guard["events"]
        assert refused["tool"] == healthcare.STEP_DISPLAY["submit_authorization"][0]
        assert "submit_authorization" not in refused["reason"]
        assert incomplete["missing"] == [healthcare.STEP_DISPLAY["track_authorization_status"][0]]
        assert [a["action"] for a in wf.audit if a["actor"] == "guard"] == ["guard_refused", "guard_incomplete"]
    finally:
        main.store.pop(wid, None)
