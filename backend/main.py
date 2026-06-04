import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv

from shared.models import ChatRequest, StreamEvent

load_dotenv()

# In-memory thread history: {thread_id: [{"role": ..., "content": ...}]}
_thread_histories: dict[str, list] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Multi-Agent Platform", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    has_key = bool(os.environ.get("OPENAI_API_KEY"))
    return {"status": "ok", "openai_key_set": has_key}


@app.get("/api/threads")
async def list_threads():
    return {"threads": list(_thread_histories.keys())}


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY is not set in environment.")

    if not request.task.strip():
        raise HTTPException(status_code=422, detail="Task cannot be empty.")

    if request.engine not in ("langgraph", "autogen"):
        raise HTTPException(status_code=422, detail=f"Unsupported engine: {request.engine}")

    history = _thread_histories.get(request.thread_id, [])

    async def event_generator():
        collected: dict[str, str] = {}
        try:
            if request.engine == "langgraph":
                from engines.langgraph_engine import run_stream
            else:
                from engines.autogen_engine import run_stream

            async for evt in run_stream(request.task, history, api_key):
                if evt.event == "token" and evt.agent:
                    collected[evt.agent] = collected.get(evt.agent, "") + (evt.content or "")
                yield {"data": evt.model_dump_json()}

        except Exception as exc:
            err = StreamEvent(event="error", error=str(exc))
            yield {"data": err.model_dump_json()}

        # Save conversation to thread history
        _thread_histories[request.thread_id] = history + [
            {"role": "user", "content": request.task},
            *[
                {"role": "assistant", "name": agent, "content": text}
                for agent, text in collected.items()
            ],
        ]

    return EventSourceResponse(event_generator())
