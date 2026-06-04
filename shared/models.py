from pydantic import BaseModel
from typing import Optional, Literal


class ChatRequest(BaseModel):
    task: str
    engine: Literal["langgraph", "autogen"]
    thread_id: str


class StreamEvent(BaseModel):
    event: Literal["agent_start", "token", "agent_complete", "complete", "error"]
    agent: Optional[str] = None
    content: Optional[str] = None
    error: Optional[str] = None
