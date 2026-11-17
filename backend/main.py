import asyncio
import uuid
from datetime import datetime
from typing import Dict

import json
from pathlib import Path

from fastapi import Depends, FastAPI, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")

import auth
import db
import fhir_import
from models import ApprovalRequest, WorkflowRequest, WorkflowStatus, WorkflowStatusResponse, AgentStep, StepStatus, SubmitResponse
from agent_runner import run_agent
from verticals.registry import get_vertical, list_verticals
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

    vertical = get_vertical(request.vertical_id)
    display = lambda t: vertical.STEP_DISPLAY.get(t, (t,))[0] if t else t
    if getattr(vertical, "TOOL_ORDER", None):
        store[workflow_id].guard = {"order": [display(t) for t in vertical.TOOL_ORDER], "events": []}

    def _plain(text: str) -> str:  # tool names -> the step names the UI shows
        for t in sorted(vertical.STEP_DISPLAY, key=len, reverse=True):
            text = text.replace(t, display(t))
        return text

    def on_guard(event: dict):
        wf = store[workflow_id]
        shown = {**event, **({"tool": display(event["tool"])} if event.get("tool") else {}),
                 **({"next": display(event["next"])} if event.get("next") else {}),
                 **({"missing": [display(t) for t in event["missing"]]} if event.get("missing") else {}),
                 **({"reason": _plain(event["reason"])} if event.get("reason") else {}),
                 "ts": datetime.utcnow().isoformat()}
        if wf.guard is not None:
            wf.guard["events"].append(shown)
        note = {"refused": lambda e: f'{e["tool"]} refused: {e["reason"]}',
                "nudged": lambda e: f'model stopped early; asked to finish {", ".join(e["missing"])}',
                "incomplete": lambda e: f'run ended without {", ".join(e["missing"])}'}[event["kind"]](shown)
        log(wf, "guard", f'guard_{event["kind"]}', note)

    try:
        result = await run_agent(request.vertical_id, request.ai_provider, request.form_data, step_callback, gate,
                                 on_guard=on_guard)
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


class LoginRequest(BaseModel):
    username: str
    password: str  # the PIN for the demo accounts


class RegisterRequest(BaseModel):
    full_name: str
    email: str
    organization: str = ""
    password: str


class RoleRequest(BaseModel):
    role: str


@app.get("/api/auth/config")
async def auth_config():
    demo = [{"name": n, "role": r, "pin": pin} for n, (r, pin) in auth._users().items()] if auth.using_demo_accounts() else []
    return {"enabled": auth.enabled(), "roles": list(auth.ROLES), "demo_accounts": demo, "min_password": auth.MIN_PASSWORD}


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    if not auth.enabled():
        raise HTTPException(status_code=404, detail="Sign-in is not enabled")
    token = auth.login(body.username.strip(), body.password)
    if token is None:
        raise HTTPException(status_code=401, detail="Wrong name or PIN")
    user = auth.verify(token)
    return {"token": token, "name": user.name, "display": user.display, "role": user.role}


@app.post("/api/auth/register", status_code=201)
async def register(body: RegisterRequest):
    """Sign up. Always creates a staff account; only a reviewer can promote it."""
    if not auth.enabled():
        raise HTTPException(status_code=404, detail="Sign-in is not enabled")
    token = auth.register(body.full_name, body.email, body.password, body.organization)
    user = auth.verify(token)
    return {"token": token, "name": user.name, "display": user.display, "role": user.role}


@app.get("/api/users")
async def users(user: auth.User | None = Depends(auth.current_user)):
    auth.require_reviewer(user)
    env = [{"name": n, "role": r, "created_at": None, "display": n, "organization": "", "source": "demo/config"} for n, (r, _) in auth._users().items()]
    return env + [{**u, "source": "signed up"} for u in db.list_users()]


@app.post("/api/users/{name}/role")
async def set_role(name: str, body: RoleRequest, user: auth.User | None = Depends(auth.current_user)):
    auth.require_reviewer(user)
    if body.role not in auth.ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {', '.join(auth.ROLES)}")
    if name.lower() == user.name.lower():
        raise HTTPException(status_code=403, detail="You cannot change your own role")
    if name in auth._users():
        raise HTTPException(status_code=400, detail="That account's role is set in the server configuration")
    if not db.set_user_role(name, body.role):
        raise HTTPException(status_code=404, detail="No such user")
    return {"name": name, "role": body.role}


@app.get("/api/verticals")
async def get_verticals():
    return list_verticals()


MAX_UPLOAD_BYTES = 25 * 1024 * 1024
SAMPLES_DIR = Path(__file__).parent / "samples"
SAMPLES = [  # synthetic Synthea patients, trimmed to the resources the importer reads
    {"file": "sample-pt-8-weeks.json", "label": "Physical therapy, 8 weeks", "description": "Chronic low back pain, 10 physical-therapy sessions over 8 weeks, ibuprofen."},
    {"file": "sample-no-therapy.json", "label": "No physical therapy", "description": "Low back pain with prescriptions only; their stop dates are not in the file."},
    {"file": "sample-opioid-history.json", "label": "Opioid history", "description": "Physical therapy plus repeated oxycodone prescriptions."},
]


@app.post("/api/patient-records/upload")
async def upload_patient_record(file: UploadFile = File(...), user: auth.User | None = Depends(auth.current_user)):
    """Read a FHIR R4 patient bundle. The record is kept in memory for two hours and never saved to the database."""
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "The file is larger than 25 MB.")
    try:
        bundle = json.loads(raw)
    except ValueError:
        raise HTTPException(400, "The file is not JSON. Upload a FHIR R4 patient bundle (.json).")
    try:
        record = fhir_import.record_from_bundle(bundle)
    except fhir_import.BundleError as e:
        raise HTTPException(400, str(e))
    except Exception:
        raise HTTPException(400, "The bundle could not be read. Check that it is a FHIR R4 patient bundle.")
    patient_id = fhir_import.save_upload(record, user.name if user else "")
    return {"patient_id": patient_id, "expires_in_seconds": fhir_import.UPLOAD_TTL, "summary": fhir_import.summary(record)}


@app.get("/api/patient-records/samples")
async def list_samples():
    return SAMPLES


@app.get("/api/patient-records/samples/{name}")
async def get_sample(name: str):
    if name not in {s["file"] for s in SAMPLES}:
        raise HTTPException(404, "No such sample")
    return FileResponse(SAMPLES_DIR / name, media_type="application/fhir+json", filename=name)


@app.post("/api/workflow/submit", response_model=SubmitResponse)
async def submit_workflow(request: WorkflowRequest, background_tasks: BackgroundTasks,
                          user: auth.User | None = Depends(auth.current_user)):
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
    store[workflow_id].submitted_by = user.name if user else None
    log(store[workflow_id], user.label if user else "staff", "created")

    background_tasks.add_task(process_workflow, workflow_id, request)

    return SubmitResponse(
        workflow_id=workflow_id,
        status=WorkflowStatus.pending,
        message="Workflow started."
    )


@app.post("/api/workflow/{workflow_id}/approve")
async def approve(workflow_id: str, body: ApprovalRequest, user: auth.User | None = Depends(auth.current_user)):
    auth.require_reviewer(user)
    wf = store.get(workflow_id)
    pending = approvals.get(workflow_id)
    if not wf or not pending or wf.status != WorkflowStatus.awaiting_approval:
        raise HTTPException(status_code=409, detail="This request is not awaiting approval")
    if user is not None and wf.submitted_by == user.name:
        raise HTTPException(status_code=403, detail="A request must be approved by someone other than the person who submitted it")
    reviewer = user.label if user else body.reviewer  # signed-in name wins over whatever the client typed
    pending["approved"] = body.approved
    wf.status = WorkflowStatus.processing
    log(wf, reviewer, "approved" if body.approved else "rejected_by_reviewer", body.note)
    pending["event"].set()
    return {"status": wf.status}


@app.get("/api/workflow/{workflow_id}/status", response_model=WorkflowStatusResponse)
async def get_status(workflow_id: str, user: auth.User | None = Depends(auth.current_user)):
    if workflow_id not in store:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return store[workflow_id]


@app.get("/api/workflow/history/all")
async def get_history(user: auth.User | None = Depends(auth.current_user)):
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
async def reset(user: auth.User | None = Depends(auth.current_user)):
    auth.require_reviewer(user)
    store.clear()
    db.clear()
    return {"message": "Reset complete"}


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest, user: auth.User | None = Depends(auth.current_user)):
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
