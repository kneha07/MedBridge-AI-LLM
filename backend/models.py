from pydantic import BaseModel
from typing import Optional, List, Any
from enum import Enum


class AIProvider(str, Enum):
    claude = "claude"
    groq = "groq"
    bedrock = "bedrock"


class StepStatus(str, Enum):
    pending = "pending"
    running = "running"
    done = "done"
    error = "error"


class WorkflowStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    awaiting_approval = "awaiting_approval"
    rejected = "rejected"
    submitted = "submitted"
    approved = "approved"
    denied = "denied"
    needs_info = "needs_info"


class AgentStep(BaseModel):
    tool_name: str
    status: StepStatus
    message: str
    timestamp: str
    data: Optional[dict] = None


class WorkflowRequest(BaseModel):
    vertical_id: str
    ai_provider: AIProvider = AIProvider.groq
    form_data: dict


class WorkflowStatusResponse(BaseModel):
    workflow_id: str
    vertical_id: str
    ai_provider: str
    status: WorkflowStatus
    created_at: str
    updated_at: str
    steps: List[AgentStep] = []
    result: Optional[str] = None
    form_data: Optional[dict] = None
    audit: List[dict] = []


class ApprovalRequest(BaseModel):
    approved: bool
    reviewer: str = "Demo Reviewer"
    note: str = ""


class SubmitResponse(BaseModel):
    workflow_id: str
    status: WorkflowStatus
    message: str
