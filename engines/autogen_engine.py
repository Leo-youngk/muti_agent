import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import AsyncGenerator
from shared.models import StreamEvent

AGENT_PROMPTS = {
    "Researcher": (
        "You are the Researcher agent. Carefully analyze the given task, "
        "identify key aspects, gather relevant insights, and propose initial solutions. "
        "Be thorough and structured. Respond only with your analysis."
    ),
    "Critic": (
        "You are the Critic agent. Review the Researcher's analysis: identify weaknesses, "
        "risks, gaps, unstated assumptions, and areas for improvement. "
        "Be constructive but direct. Respond only with your critique."
    ),
    "Synthesizer": (
        "You are the Synthesizer agent. Integrate the Researcher's analysis and the Critic's "
        "review into a clear, complete, and actionable final response. "
        "Resolve conflicts, keep what is valuable, produce a polished conclusion. "
        "Respond only with your synthesis."
    ),
}


async def run_stream(
    task: str, history: list, api_key: str
) -> AsyncGenerator[StreamEvent, None]:
    from autogen_agentchat.agents import AssistantAgent
    from autogen_agentchat.teams import RoundRobinGroupChat
    from autogen_agentchat.conditions import MaxMessageTermination
    from autogen_agentchat.messages import ModelClientStreamingChunkEvent, TextMessage
    from autogen_agentchat.base import TaskResult
    from autogen_ext.models.openai import OpenAIChatCompletionClient

    model_client = OpenAIChatCompletionClient(
        model="gpt-4o",
        api_key=api_key,
    )

    agents = [
        AssistantAgent(
            name=name,
            model_client=model_client,
            system_message=AGENT_PROMPTS[name],
            model_client_stream=True,
        )
        for name in ("Researcher", "Critic", "Synthesizer")
    ]

    team = RoundRobinGroupChat(
        participants=agents,
        termination_condition=MaxMessageTermination(max_messages=3),
    )

    current_agent: str | None = None

    try:
        async for event in team.run_stream(task=task):
            if isinstance(event, TaskResult):
                break

            agent_name = getattr(event, "source", None)
            if agent_name and agent_name != current_agent and agent_name in AGENT_PROMPTS:
                if current_agent is not None:
                    yield StreamEvent(event="agent_complete", agent=current_agent)
                current_agent = agent_name
                yield StreamEvent(event="agent_start", agent=current_agent)

            if isinstance(event, ModelClientStreamingChunkEvent):
                token = event.content
                if token and current_agent:
                    yield StreamEvent(event="token", agent=current_agent, content=token)

        if current_agent:
            yield StreamEvent(event="agent_complete", agent=current_agent)

    except Exception as exc:
        yield StreamEvent(event="error", error=str(exc))
    finally:
        await model_client.close()

    yield StreamEvent(event="complete")
