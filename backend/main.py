import asyncio
import uuid
from datetime import datetime
from typing import Dict

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")

import db
from models import ApprovalRequest, WorkflowRequest, WorkflowStatus, WorkflowStatusResponse, AgentStep, StepStatus, SubmitResponse
from agent_runner import run_agent
from verticals.registry import list_verticals
from chat import chat as run_chat
from pydantic import BaseModel

app = FastAPI(title="MedBridge Platform API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:5174", "http://localhost:5175",
                   "http://localhost:5176", "http://localhost:5177",
                   "http://localhost:5200", "http://127.0.0.1:5200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store: Dict[str, WorkflowStatusResponse] = {wf.workflow_id: wf for wf in db.load_all()}
approvals: Dict[str, dict] = {}   # workflow_id -> {"event": asyncio.Event, "approved": bool}

# Runs interrupted by a restart can't resume (the approval wait lived in memory).
for _wf in store.values():
    if _wf.status in (WorkflowStatus.processing, WorkflowStatus.awaiting_approval, WorkflowStatus.pending):
        _wf.status = WorkflowStatus.needs_info
        _wf.result = "Interrupted by a server restart. Please resubmit."
        db.save(_wf)


def friendly_error(e: Exception) -> str:
    """Plain-language message for the UI; the raw error stays in the server log."""
    import logging
    logging.getLogger("uvicorn.error").error("workflow/chat error: %s", e)
    if "429" in str(e) or "rate limit" in str(e).lower():
        return "The AI service's usage limit was reached. Please wait a few minutes and try again."
    return "Something went wrong while processing this request. Please try again."


def log(wf: WorkflowStatusResponse, actor: str, action: str, note: str = ""):
    wf.audit.append({"ts": datetime.utcnow().isoformat(), "actor": actor, "action": action, "note": note})
    wf.updated_at = wf.audit[-1]["ts"]
    db.save(wf)


async def process_workflow(workflow_id: str, request: WorkflowRequest):
    store[workflow_id].status = WorkflowStatus.processing
    log(store[workflow_id], "agent", "started")

    async def gate(tool_name: str) -> bool:
        wf = store[workflow_id]
        approvals[workflow_id] = {"event": asyncio.Event(), "approved": False}
        wf.status = WorkflowStatus.awaiting_approval
        log(wf, "agent", "approval_requested", tool_name)
        await approvals[workflow_id]["event"].wait()
        return approvals[workflow_id]["approved"]

    async def step_callback(step: AgentStep):
        existing = store[workflow_id].steps
        updated = False
        for i, s in enumerate(existing):
            if s.tool_name == step.tool_name and s.status == StepStatus.running and step.status == StepStatus.done:
                existing[i] = step
                updated = True
                break
        if not updated:
            existing.append(step)
        store[workflow_id].steps = existing
        store[workflow_id].updated_at = datetime.utcnow().isoformat()
        db.save(store[workflow_id])

    try:
        result = await run_agent(request.vertical_id, request.ai_provider, request.form_data, step_callback, gate)
        wf = store[workflow_id]
        rejected = workflow_id in approvals and not approvals[workflow_id]["approved"]
        wf.status = WorkflowStatus.rejected if rejected else WorkflowStatus.submitted
        wf.result = result
        log(wf, "agent", "rejected" if rejected else "completed")
    except Exception as e:
        wf = store[workflow_id]
        wf.status = WorkflowStatus.needs_info
        wf.result = friendly_error(e)
        log(wf, "agent", "error", wf.result)
    finally:
        approvals.pop(workflow_id, None)


@app.get("/api/verticals")
async def get_verticals():
    return list_verticals()


@app.post("/api/workflow/submit", response_model=SubmitResponse)
async def submit_workflow(request: WorkflowRequest, background_tasks: BackgroundTasks):
    workflow_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    store[workflow_id] = WorkflowStatusResponse(
        workflow_id=workflow_id,
        vertical_id=request.vertical_id,
        ai_provider=request.ai_provider,
        status=WorkflowStatus.pending,
        created_at=now,
        updated_at=now,
        steps=[],
        result=None,
        form_data=request.form_data
    )
    log(store[workflow_id], "staff", "created")

    background_tasks.add_task(process_workflow, workflow_id, request)

    return SubmitResponse(
        workflow_id=workflow_id,
        status=WorkflowStatus.pending,
        message="Workflow started."
    )


@app.post("/api/workflow/{workflow_id}/approve")
async def approve(workflow_id: str, body: ApprovalRequest):
    wf = store.get(workflow_id)
    pending = approvals.get(workflow_id)
    if not wf or not pending or wf.status != WorkflowStatus.awaiting_approval:
        raise HTTPException(status_code=409, detail="This request is not awaiting approval")
    pending["approved"] = body.approved
    wf.status = WorkflowStatus.processing
    log(wf, body.reviewer, "approved" if body.approved else "rejected_by_reviewer", body.note)
    pending["event"].set()
    return {"status": wf.status}


@app.get("/api/workflow/{workflow_id}/status", response_model=WorkflowStatusResponse)
async def get_status(workflow_id: str):
    if workflow_id not in store:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return store[workflow_id]


@app.get("/api/workflow/history/all")
async def get_history():
    return sorted([
        {
            "workflow_id": wf.workflow_id,
            "vertical_id": wf.vertical_id,
            "status": wf.status,
            "created_at": wf.created_at,
            "insurance": (wf.form_data or {}).get("insurance_provider"),
            "treatment": (wf.form_data or {}).get("treatment_type"),
            "summary": next((v for k, v in (wf.form_data or {}).items() if k in ["patient_name", "client_name", "applicant_name"]), "Unknown"),
        }
        for wf in store.values()
    ], key=lambda x: x["created_at"], reverse=True)


@app.post("/api/demo/reset")
async def reset():
    store.clear()
    db.clear()
    return {"message": "Reset complete"}


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    history = [m.model_dump() for m in req.messages if m.role in ("user", "assistant")][-12:]
    if not history or history[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="Last message must be from the user")
    try:
        return await run_chat(history)
    except Exception as e:
        raise HTTPException(status_code=502, detail=friendly_error(e))


@app.get("/health")
async def health():
    return {"status": "ok", "service": "MedBridge Platform", "version": "2.0.0"}
