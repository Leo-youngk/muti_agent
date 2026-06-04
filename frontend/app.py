import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import uuid
import requests
import streamlit as st

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

# ── Agent palette ────────────────────────────────────────────────────────────
AGENTS = {
    "Researcher": {
        "color": "#0071E3",
        "bg": "#F0F7FF",
        "icon": "🔍",
        "label": "Researcher",
    },
    "Critic": {
        "color": "#FF6B35",
        "bg": "#FFF5F0",
        "icon": "🧐",
        "label": "Critic",
    },
    "Synthesizer": {
        "color": "#34C759",
        "bg": "#F0FFF4",
        "icon": "✨",
        "label": "Synthesizer",
    },
}

# ── CSS ───────────────────────────────────────────────────────────────────────
CSS = """
<style>
/* ---------- global ---------- */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

html, body, [data-testid="stAppViewContainer"] {
    background: #F5F5F7 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif !important;
}

[data-testid="stAppViewBlockContainer"] {
    max-width: 860px !important;
    padding: 2rem 1.5rem 4rem !important;
}

/* ---------- sidebar ---------- */
[data-testid="stSidebar"] {
    background: rgba(255,255,255,0.92) !important;
    border-right: 1px solid rgba(0,0,0,0.07) !important;
    backdrop-filter: blur(20px) !important;
}
[data-testid="stSidebar"] * {
    font-family: inherit !important;
}
[data-testid="stSidebarContent"] {
    padding: 1.5rem 1.25rem !important;
}

/* ---------- headings ---------- */
h1 { font-size: 1.75rem !important; font-weight: 700 !important; letter-spacing: -0.03em !important; color: #1d1d1f !important; }
h2 { font-size: 1.1rem !important; font-weight: 600 !important; letter-spacing: -0.02em !important; color: #1d1d1f !important; }
h3 { font-size: 0.95rem !important; font-weight: 600 !important; color: #1d1d1f !important; }

/* ---------- buttons ---------- */
.stButton > button {
    background: #0071E3 !important;
    color: #fff !important;
    border: none !important;
    border-radius: 980px !important;
    padding: 0.55rem 1.6rem !important;
    font-size: 0.9rem !important;
    font-weight: 500 !important;
    letter-spacing: -0.01em !important;
    transition: background 0.18s, transform 0.12s !important;
    width: 100% !important;
    box-shadow: 0 1px 4px rgba(0,113,227,0.22) !important;
}
.stButton > button:hover { background: #0077ED !important; transform: scale(1.015) !important; }
.stButton > button:active { background: #005FC5 !important; transform: scale(0.99) !important; }
.stButton > button:disabled { background: #A0C4F1 !important; }

/* ---------- text input / textarea ---------- */
.stTextArea textarea {
    border-radius: 14px !important;
    border: 1.5px solid rgba(0,0,0,0.1) !important;
    background: #fff !important;
    font-family: inherit !important;
    font-size: 0.95rem !important;
    padding: 0.75rem 1rem !important;
    transition: border-color 0.18s, box-shadow 0.18s !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05) !important;
}
.stTextArea textarea:focus {
    border-color: #0071E3 !important;
    box-shadow: 0 0 0 3px rgba(0,113,227,0.14) !important;
}
.stTextArea label { font-size: 0.85rem !important; font-weight: 500 !important; color: #6e6e73 !important; }

/* ---------- selectbox ---------- */
[data-testid="stSelectbox"] > div > div {
    border-radius: 10px !important;
    border: 1.5px solid rgba(0,0,0,0.1) !important;
    background: #fff !important;
}

/* ---------- text input ---------- */
[data-testid="stTextInput"] input {
    border-radius: 10px !important;
    border: 1.5px solid rgba(0,0,0,0.1) !important;
    background: #fff !important;
    font-family: inherit !important;
}

/* ---------- alerts / errors ---------- */
[data-testid="stAlert"] {
    border-radius: 12px !important;
    font-size: 0.9rem !important;
}

/* ---------- hide branding ---------- */
#MainMenu, footer, [data-testid="stToolbar"] { visibility: hidden !important; }

/* ---------- agent card ---------- */
.agent-card {
    background: #fff;
    border-radius: 18px;
    padding: 1.1rem 1.3rem 1.2rem;
    margin: 0.65rem 0;
    box-shadow: 0 2px 10px rgba(0,0,0,0.055), 0 0 0 1px rgba(0,0,0,0.055);
    transition: box-shadow 0.2s;
    word-break: break-word;
    line-height: 1.65;
}
.agent-card:hover { box-shadow: 0 4px 18px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.06); }

.agent-header {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin-bottom: 0.55rem;
}
.agent-dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
}
.agent-name-label {
    font-size: 0.78rem;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6e6e73;
}
.agent-status {
    margin-left: auto;
    font-size: 0.73rem;
    padding: 2px 9px;
    border-radius: 20px;
    font-weight: 500;
}
.status-thinking { background: #FFF8E1; color: #9A6D00; }
.status-done     { background: #E9F9EE; color: #1A7A3C; }

.agent-body {
    font-size: 0.93rem;
    color: #1d1d1f;
    white-space: pre-wrap;
}

.cursor { animation: blink 0.9s step-end infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

/* ---------- task input section ---------- */
.task-section {
    background: #fff;
    border-radius: 18px;
    padding: 1.2rem 1.3rem;
    box-shadow: 0 2px 10px rgba(0,0,0,0.055), 0 0 0 1px rgba(0,0,0,0.055);
    margin-bottom: 1.4rem;
}

/* ---------- thread chips ---------- */
.thread-chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 0.4rem 0; }
.thread-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.76rem; font-weight: 500;
    border: 1.5px solid rgba(0,0,0,0.1);
    background: #F5F5F7;
    color: #1d1d1f;
    cursor: pointer;
    transition: all 0.15s;
}
.thread-chip-active {
    background: #0071E3; color: #fff; border-color: #0071E3;
}

/* ---------- divider ---------- */
hr { border: none !important; border-top: 1px solid rgba(0,0,0,0.07) !important; margin: 1rem 0 !important; }

/* ---------- sidebar label ---------- */
.sidebar-label {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #8a8a8e;
    margin: 1rem 0 0.3rem;
}
</style>
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def render_agent_card(agent: str, content: str, status: str) -> str:
    cfg = AGENTS.get(agent, {"color": "#888", "bg": "#F5F5F7", "icon": "🤖", "label": agent})
    status_html = (
        f'<span class="agent-status status-thinking">thinking…</span>'
        if status == "thinking"
        else f'<span class="agent-status status-done">done</span>'
        if status == "done"
        else ""
    )
    cursor = '<span class="cursor">▎</span>' if status == "thinking" else ""
    safe_content = content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"""
<div class="agent-card" style="border-left: 4px solid {cfg['color']}; background: {cfg['bg']};">
  <div class="agent-header">
    <div class="agent-dot" style="background:{cfg['color']};"></div>
    <span class="agent-name-label">{cfg['icon']} {cfg['label']}</span>
    {status_html}
  </div>
  <div class="agent-body">{safe_content}{cursor}</div>
</div>"""


def stream_events(task: str, engine: str, thread_id: str):
    url = f"{BACKEND_URL}/api/chat/stream"
    try:
        with requests.post(url, json={"task": task, "engine": engine, "thread_id": thread_id}, stream=True, timeout=180) as resp:
            if resp.status_code != 200:
                yield {"event": "error", "error": f"Backend error {resp.status_code}: {resp.text}"}
                return
            for raw_line in resp.iter_lines():
                if not raw_line:
                    continue
                line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
                if line.startswith("data: "):
                    payload = line[6:].strip()
                    if payload:
                        try:
                            yield json.loads(payload)
                        except json.JSONDecodeError:
                            pass
    except requests.exceptions.ConnectionError:
        yield {"event": "error", "error": "Cannot connect to backend (http://localhost:8000). Is it running?"}
    except Exception as exc:
        yield {"event": "error", "error": str(exc)}


# ── Session state init ────────────────────────────────────────────────────────

def _init_state():
    if "threads" not in st.session_state:
        first = str(uuid.uuid4())[:8]
        st.session_state.threads = [first]
        st.session_state.active_thread = first
        st.session_state.messages = {first: []}
    if "engine" not in st.session_state:
        st.session_state.engine = "langgraph"
    if "streaming" not in st.session_state:
        st.session_state.streaming = False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    st.set_page_config(
        page_title="Multi-Agent Platform",
        page_icon="🤖",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    st.markdown(CSS, unsafe_allow_html=True)
    _init_state()

    # ── Sidebar ──────────────────────────────────────────────────────────────
    with st.sidebar:
        st.markdown("## 🤖 Multi-Agent")
        st.markdown("<div class='sidebar-label'>Engine</div>", unsafe_allow_html=True)
        engine = st.selectbox(
            "Engine",
            options=["langgraph", "autogen"],
            index=0 if st.session_state.engine == "langgraph" else 1,
            label_visibility="collapsed",
        )
        st.session_state.engine = engine

        st.markdown(
            "<div style='font-size:0.78rem;color:#8a8a8e;margin-top:4px;'>"
            + ("Sequential graph · token streaming" if engine == "langgraph" else "GroupChat · message streaming")
            + "</div>",
            unsafe_allow_html=True,
        )

        st.markdown("<div class='sidebar-label'>Threads</div>", unsafe_allow_html=True)

        for tid in st.session_state.threads:
            is_active = tid == st.session_state.active_thread
            label = f"{'● ' if is_active else '○ '}Thread {tid}"
            btn_type = "primary" if is_active else "secondary"
            if st.button(label, key=f"thread_btn_{tid}", type=btn_type, use_container_width=True):
                st.session_state.active_thread = tid
                st.rerun()

        st.markdown("")
        if st.button("＋ New thread", use_container_width=True):
            new_id = str(uuid.uuid4())[:8]
            st.session_state.threads.append(new_id)
            st.session_state.messages[new_id] = []
            st.session_state.active_thread = new_id
            st.rerun()

        st.markdown("---")
        st.markdown("<div class='sidebar-label'>Agents</div>", unsafe_allow_html=True)
        for name, cfg in AGENTS.items():
            st.markdown(
                f"<div style='display:flex;align-items:center;gap:7px;margin:5px 0;font-size:0.85rem;'>"
                f"<div style='width:8px;height:8px;border-radius:50%;background:{cfg['color']};flex-shrink:0;'></div>"
                f"<span style='font-weight:500;'>{cfg['icon']} {name}</span>"
                f"</div>",
                unsafe_allow_html=True,
            )

    # ── Main area ─────────────────────────────────────────────────────────────
    thread_id = st.session_state.active_thread

    st.markdown(
        f"<h1 style='margin-bottom:0.2rem;'>Multi-Agent Platform</h1>"
        f"<p style='color:#6e6e73;font-size:0.88rem;margin-top:0;'>Thread <code style='background:#e8e8ed;padding:2px 7px;border-radius:6px;font-size:0.82rem;'>{thread_id}</code> · {engine.upper()}</p>",
        unsafe_allow_html=True,
    )

    # Past messages
    msgs = st.session_state.messages.get(thread_id, [])
    if msgs:
        for msg in msgs:
            if msg["role"] == "user":
                st.markdown(
                    f"<div style='background:#fff;border-radius:14px;padding:0.8rem 1.1rem;"
                    f"box-shadow:0 2px 8px rgba(0,0,0,0.06);margin:0.5rem 0;"
                    f"border-left:4px solid #8E8E93;font-size:0.93rem;color:#1d1d1f;'>"
                    f"<span style='font-size:0.72rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#8E8E93;'>🙋 You</span><br/>"
                    f"{msg['content'].replace(chr(10), '<br/>')}</div>",
                    unsafe_allow_html=True,
                )
            else:
                agent = msg.get("agent", "Agent")
                st.markdown(
                    render_agent_card(agent, msg["content"], "done"),
                    unsafe_allow_html=True,
                )

    # Task input
    st.markdown("<div class='task-section'>", unsafe_allow_html=True)
    task = st.text_area(
        "Describe your task",
        placeholder="e.g. Evaluate the pros and cons of microservices vs. monolithic architecture for a startup…",
        height=110,
        key=f"task_input_{thread_id}",
        label_visibility="visible",
    )
    col1, col2 = st.columns([3, 1])
    with col2:
        submit = st.button("Send →", disabled=st.session_state.streaming, type="primary")
    st.markdown("</div>", unsafe_allow_html=True)

    # Error placeholder
    error_ph = st.empty()

    # ── Stream ─────────────────────────────────────────────────────────────
    if submit and task.strip():
        st.session_state.streaming = True

        # Show user message
        st.markdown(
            f"<div style='background:#fff;border-radius:14px;padding:0.8rem 1.1rem;"
            f"box-shadow:0 2px 8px rgba(0,0,0,0.06);margin:0.5rem 0;"
            f"border-left:4px solid #8E8E93;font-size:0.93rem;color:#1d1d1f;'>"
            f"<span style='font-size:0.72rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#8E8E93;'>🙋 You</span><br/>"
            f"{task.replace(chr(10), '<br/>')}</div>",
            unsafe_allow_html=True,
        )

        # Placeholders for each agent
        placeholders = {name: st.empty() for name in AGENTS}
        contents: dict[str, str] = {name: "" for name in AGENTS}
        statuses: dict[str, str] = {name: "idle" for name in AGENTS}

        # Show initial "waiting" state
        for name in AGENTS:
            placeholders[name].markdown(
                render_agent_card(name, "Waiting…", "idle"), unsafe_allow_html=True
            )

        new_messages = [{"role": "user", "content": task}]
        had_error = False

        for evt in stream_events(task, engine, thread_id):
            etype = evt.get("event")

            if etype == "agent_start":
                agent = evt.get("agent", "")
                if agent in statuses:
                    statuses[agent] = "thinking"
                    placeholders[agent].markdown(
                        render_agent_card(agent, "", "thinking"), unsafe_allow_html=True
                    )

            elif etype == "token":
                agent = evt.get("agent", "")
                token = evt.get("content") or ""
                if agent in contents:
                    contents[agent] += token
                    placeholders[agent].markdown(
                        render_agent_card(agent, contents[agent], "thinking"),
                        unsafe_allow_html=True,
                    )

            elif etype == "agent_complete":
                agent = evt.get("agent", "")
                if agent in statuses:
                    statuses[agent] = "done"
                    placeholders[agent].markdown(
                        render_agent_card(agent, contents[agent], "done"),
                        unsafe_allow_html=True,
                    )
                    if contents[agent]:
                        new_messages.append({"role": "assistant", "agent": agent, "content": contents[agent]})

            elif etype == "complete":
                break

            elif etype == "error":
                error_ph.error(f"⚠️ {evt.get('error', 'Unknown error')}")
                had_error = True
                break

        # Finalise any agents that completed via content but missed agent_complete
        for name in AGENTS:
            if statuses[name] == "thinking":
                statuses[name] = "done"
                placeholders[name].markdown(
                    render_agent_card(name, contents[name], "done"), unsafe_allow_html=True
                )

        if not had_error:
            # Save to session history
            if thread_id not in st.session_state.messages:
                st.session_state.messages[thread_id] = []
            st.session_state.messages[thread_id].extend(new_messages)

        st.session_state.streaming = False

    elif submit and not task.strip():
        error_ph.warning("Please enter a task first.")


if __name__ == "__main__":
    main()
