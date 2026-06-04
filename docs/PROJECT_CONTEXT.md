# 项目上下文

本文件由 AI 根据代码库、README、配置文件和 `USER_BRIEF.md` 自动维护。

## 产品

本地可运行的多 Agent 对话 Web 应用。用户输入任务描述，由三个 AI Agent（Researcher、Critic、Synthesizer）协作完成分析，结果实时流式展示。

## 目标用户

需要 AI 辅助进行任务分析与决策的个人开发者或研究者，偏好本地私有部署。

## 核心流程

1. 用户在 Streamlit 前端选择引擎（LangGraph / AutoGen）和会话 Thread。
2. 用户输入任务描述并提交。
3. 前端通过 SSE 请求后端 `/api/chat/stream`。
4. 后端根据引擎启动多 Agent 对话，流式返回每个 Agent 的 token。
5. 前端实时更新对应 Agent 卡片的内容，完成后显示 done 状态。
6. 会话历史保存在内存中，支持多 Thread 切换。

## 当前不做

- 持久化存储（无数据库）
- 用户认证
- 自定义 Agent 配置
- 部署到云端

## 技术栈

- 前端：Streamlit ≥ 1.35，自定义 Apple/Claude 风格 CSS
- 后端：FastAPI + sse-starlette，uvicorn
- LangGraph 引擎：LangGraph + LangChain + langchain-openai
- AutoGen 引擎：pyautogen ≥ 0.2
- 模型：OpenAI gpt-4o
- 配置：OPENAI_API_KEY 从环境变量读取

## 目录结构

```
backend/main.py          FastAPI 应用，SSE 流式端点
engines/langgraph_engine.py   LangGraph 三节点顺序图，astream_events 真实 token 流
engines/autogen_engine.py     AutoGen GroupChat，monkey-patch generate_reply 捕获消息
shared/models.py         Pydantic 数据模型（ChatRequest, StreamEvent）
frontend/app.py          Streamlit UI，Apple/Claude 风格，实时流式渲染
requirements.txt
.env.example
```

## 架构规则

- UI 代码与业务逻辑保持分离（frontend/ vs backend/ vs engines/）。
- 引擎封装在独立模块，通过统一的 `run_stream(task, history, api_key)` 接口暴露。
- 外部输入在后端边界处校验（空任务、缺少 API Key、不支持的引擎）。

## AI 假设

- AutoGen GroupChat 的 `generate_reply` monkey-patch 在 pyautogen 0.2.x 下有效；0.4+ 需换新 API。
- 线程历史仅保存在内存，重启后丢失（符合当前不做持久化的要求）。
