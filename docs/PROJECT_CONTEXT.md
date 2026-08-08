# 项目上下文

本文件由 AI 根据代码库、README、配置文件和 `USER_BRIEF.md` 自动维护。当前版本已与真实代码核对一致（见 `docs/RETROSPECTIVE.md`）。

## 产品

一个本地可运行的多 Agent 讨论室（PWA）。用户输入一个问题，配置中的任意数量 AI Agent 会各自给出结构化判断；界面按配置顺序把回答组织成一篇单列长文，支持单独追问与继续讨论。内置四位历史人物 Agent 只是默认配置，不是产品品牌，也不是数量上限。

> 注意：`USER_BRIEF.md` 描述的原始设想（FastAPI + Streamlit + LangGraph/AutoGen 的 Researcher/Critic/Synthesizer 流水线）已被实际产品形态取代。前端已改为 Next.js 全栈应用，后端 FastAPI 与引擎模块成为未接入的遗留代码。

## 目标用户

偏好本地私有部署、想从多个差异化思维视角审视同一个问题的个人。产品以 iOS PWA 为主要使用场景，信息与文字阅读优先，适配刘海屏和 safe-area。

## 核心流程

1. 用户在 Next.js 前端输入一个问题（或点示例问题），选择模型。
2. 前端通过 `useStreaming` 并发调用 `/api/chat/advisor`（每个 Agent 一个独立 SSE 请求，最多 2 个并发、800ms 错开）。
3. 每个 Agent 以纯 JSON 结构返回；前端主要展示立场、核心判断和推理，其他旧字段保留在数据契约中但不再展示，token 级流式渲染。
4. 页面在请求开始时按配置顺序创建全部 Agent 章节；完成先后不会改变文档顺序。用户可自然滚动阅读或对单个 Agent 追问。
5. 会话按 Thread 组织，保存在 IndexedDB + localStorage，支持多会话切换与导出 Markdown。

## 当前不做（实际代码状态）

- 不再依赖 FastAPI 后端（`backend/` 与 `engines/` 为遗留，未接入）。
- 不再依赖 LangGraph / AutoGen 引擎。
- 没有数据库；数据持久化由浏览器 IndexedDB + localStorage 完成。
- 没有用户认证、云端部署以外的服务端状态管理。
- 只有两条 API route：`/api/chat/advisor`（每顾问独立 SSE）、`/api/chat/models`（代理服务商 `/models`，供设置页自动加载模型列表）。早期的 `/api/chat/analysis`、`/api/chat/stream` 路由与 `ConclusionSection`/`DisputeCard` 组件已作为死代码删除。

## 技术栈

### 前端（活跃，Next.js 全栈）
- Next.js 16（App Router）+ React 18 + TypeScript + Tailwind CSS
- PWA：manifest、Apple Web App、safe-area 适配（`app/layout.tsx` 的 metadata/viewport、`public/manifest.json`、`public/icons/*`；`next.config.mjs` 目前为空）
- 状态与工具：`useThreads`、`useStreaming`、`AdvisorContext`、`idb-keyval`（IndexedDB）
- 流式解析：`lib/parseStreaming.ts`（实时提取半成品 JSON 字段）
- 测试：Vitest + Testing Library（`frontend/__tests__/`，覆盖 parseJSON、extractPartial、buildHistory 等）
- API Route：`app/api/chat/advisor`（每顾问独立 SSE）、共享 prompt 工具 `app/api/chat/shared.ts`

### 模型接入
- 通过 `openai` SDK 直连兼容 OpenAI 的多种服务商：DeepSeek、OpenAI、硅基流动、火山引擎等（`SettingsModal` 里的 Provider 预设）
- 模型名由用户配置，服务端按模型族给出输出预算并统一封顶 16384（DeepSeek 131K / Qwen 65K / GLM 16K / 其他 16K）；推理型模型（deepseek-v4-flash、qwen、glm 等）先输出思考内容，预算必须留足，否则 JSON 会被截断
- `temperature` 默认 0.7，遇网关模型拒绝（如 kimi-k3 仅允许 1）时自动去掉该参数重试
- 单次调用超时 120s；API Key 优先级：前端传入（设置里填）> 环境变量 `OPENAI_API_KEY`；Base URL 同理（`OPENAI_BASE_URL`）

### 后端与引擎（遗留，未接入）
- `backend/main.py`：FastAPI + SSE，`/api/chat/stream` 按 `engine` 参数调 LangGraph 或 AutoGen
- `engines/langgraph_engine.py`：三节点顺序图（researcher → critic → synthesizer），`astream_events`
- `engines/autogen_engine.py`：AutoGen `RoundRobinGroupChat`
- `shared/models.py`：Pydantic 模型（`ChatRequest`、`StreamEvent`）
- `requirements.txt`：遗留 Python 依赖清单

## 目录结构

```
backend/main.py                 FastAPI 遗留后端（未接入）
engines/langgraph_engine.py     LangGraph 遗留引擎（未接入）
engines/autogen_engine.py       AutoGen 遗留引擎（未接入）
shared/models.py                Pydantic 遗留模型（未接入）
frontend/                       Next.js 16 全栈应用（活跃）
  app/api/chat/                 API Routes：advisor（活跃）、analysis/stream（未接线）、shared.ts
  app/layout.tsx, page.tsx      PWA 布局与入口
  components/                   ChatApp, ChatView, AgentResponseSection, ConclusionSection,
                                DisputeCard, InputBar, ModelSelector, SettingsModal,
                                Sidebar, IOSInstallBanner
  lib/                          advisors（人物档案）, types, storage（IndexedDB/localStorage）,
                                useStreaming, useThreads, parseStreaming, stream(旧), hooks
  public/                       PWA manifest 与图标
  __tests__/                    Vitest 单元测试
requirements.txt                遗留 Python 依赖
.env.example                    OPENAI_API_KEY 示例
```

## 架构规则

- 前端阅读文档 UI 与请求编排（`useStreaming`）分离。
- Agent 数量动态读取配置；章节顺序固定使用配置顺序，不使用完成顺序。
- 主阅读面采用单列自然滚动；输入器、线程抽屉和设置按需出现，不常驻挤压正文。
- 每个顾问独立 SSE 请求，前端并行调度（并发上限 2、错开 800ms），避免一个顾问失败拖垮全局。
- Prompt 构建集中在 `app/api/chat/shared.ts`，advisor / analysis 两个 route 复用同一套 prompt 与 JSON 解析工具。
- 服务端对单顾问做重试（最多 3 次）、限速退避、超时兜底（120s），解析失败时回退为「部分判断」。
- 数据迁移集中在 `lib/storage.ts`（旧 localStorage 数据 → IndexedDB，旧 analysis 格式 → 新格式）。

## 部署

- 活跃的 Next.js 全栈应用通过 `@opennextjs/cloudflare` 部署为 Cloudflare Worker，配置位于 `frontend/wrangler.jsonc` 与 `frontend/open-next.config.ts`。
- 生产 Worker：`multi-agent-discussion-room`；workers.dev URL：`https://multi-agent-discussion-room.yk2958374240.workers.dev`。
- 模型接入保持 BYOK：浏览器设置中的 API Key 随请求提供，`OPENAI_API_KEY` / `OPENAI_BASE_URL` 只作为可选服务端回退。
- OpenNext 在 Windows 跨盘临时目录复制时不稳定；本仓库在 Windows 主机上使用 Ubuntu WSL 执行 `npm run cf:build`、本地预览和部署。
- 当前开发网络无法连接 `workers.dev:443`；Cloudflare API 已确认生产版本，若目标用户位于中国大陆，应绑定自定义域名并从目标网络复测。

## 当前任务（见 docs/TASKS.md）

文字优先 iOS PWA 界面重构与 Cloudflare Workers 首次部署已完成；待办均为可选增强项（详见 TASKS.md）。
