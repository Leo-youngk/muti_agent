import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import AsyncGenerator, TypedDict
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from shared.models import StreamEvent

AGENT_PROMPTS = {
    "researcher": (
        "You are the Researcher agent. Your job is to carefully analyze the given task, "
        "identify key aspects, gather relevant insights, and propose initial solutions or approaches. "
        "Be thorough, analytical, and structured in your response."
    ),
    "critic": (
        "You are the Critic agent. The Researcher has just provided an analysis. "
        "Your job is to rigorously review that analysis: identify weaknesses, risks, gaps, "
        "unstated assumptions, and areas that need improvement. Be constructive but direct."
    ),
    "synthesizer": (
        "You are the Synthesizer agent. You have access to the Researcher's analysis and the Critic's review. "
        "Your job is to integrate both perspectives into a clear, complete, and actionable final response "
        "that addresses the original task. Resolve conflicts between the two, keep what is valuable, "
        "and produce a polished conclusion."
    ),
}


class GraphState(TypedDict):
    task: str
    history: list
    researcher_output: str
    critic_output: str
    synthesizer_output: str


def _build_graph(llm: ChatOpenAI) -> StateGraph:
    def researcher_node(state: GraphState) -> dict:
        msgs = [
            SystemMessage(content=AGENT_PROMPTS["researcher"]),
            HumanMessage(content=f"Task: {state['task']}"),
        ]
        response = llm.invoke(msgs)
        return {"researcher_output": response.content}

    def critic_node(state: GraphState) -> dict:
        msgs = [
            SystemMessage(content=AGENT_PROMPTS["critic"]),
            HumanMessage(
                content=(
                    f"Original task: {state['task']}\n\n"
                    f"Researcher's analysis:\n{state['researcher_output']}"
                )
            ),
        ]
        response = llm.invoke(msgs)
        return {"critic_output": response.content}

    def synthesizer_node(state: GraphState) -> dict:
        msgs = [
            SystemMessage(content=AGENT_PROMPTS["synthesizer"]),
            HumanMessage(
                content=(
                    f"Original task: {state['task']}\n\n"
                    f"Researcher's analysis:\n{state['researcher_output']}\n\n"
                    f"Critic's review:\n{state['critic_output']}"
                )
            ),
        ]
        response = llm.invoke(msgs)
        return {"synthesizer_output": response.content}

    graph = StateGraph(GraphState)
    graph.add_node("researcher", researcher_node)
    graph.add_node("critic", critic_node)
    graph.add_node("synthesizer", synthesizer_node)
    graph.set_entry_point("researcher")
    graph.add_edge("researcher", "critic")
    graph.add_edge("critic", "synthesizer")
    graph.add_edge("synthesizer", END)
    return graph.compile()


async def run_stream(
    task: str, history: list, api_key: str
) -> AsyncGenerator[StreamEvent, None]:
    llm = ChatOpenAI(
        model="gpt-4o",
        openai_api_key=api_key,
        streaming=True,
        temperature=0.7,
    )
    app = _build_graph(llm)

    initial_state: GraphState = {
        "task": task,
        "history": history,
        "researcher_output": "",
        "critic_output": "",
        "synthesizer_output": "",
    }

    agent_order = ("researcher", "critic", "synthesizer")
    active_agent = None

    async for event in app.astream_events(initial_state, version="v2"):
        etype = event["event"]
        name = event.get("name", "")

        if etype == "on_chain_start" and name in agent_order:
            active_agent = name
            yield StreamEvent(event="agent_start", agent=name.capitalize())

        elif etype == "on_chat_model_stream":
            chunk = event["data"].get("chunk")
            if chunk and chunk.content:
                node = event.get("metadata", {}).get("langgraph_node", "")
                if node in agent_order:
                    yield StreamEvent(
                        event="token", agent=node.capitalize(), content=chunk.content
                    )

        elif etype == "on_chain_end" and name in agent_order:
            output = event["data"].get("output", {})
            content = output.get(f"{name}_output", "")
            yield StreamEvent(
                event="agent_complete", agent=name.capitalize(), content=content
            )

    yield StreamEvent(event="complete")
