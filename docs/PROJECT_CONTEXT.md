# 项目上下文

本文件由 AI 根据代码库、README、配置文件和 `USER_BRIEF.md` 自动维护。当前版本已与真实代码核对一致（见 `docs/RETROSPECTIVE.md`）。

## 产品

一个本地可运行的多 Agent 讨论室（PWA）。用户输入一个问题，配置中的任意数量 AI Agent 会各自给出结构化判断；界面按本轮保存的顾问顺序组织成单列长文，支持多轮对话与定向追问。内置 14 位人物顾问，其中四位默认启用，用户还可以自定义角色。

> 注意：`USER_BRIEF.md` 描述的原始设想（FastAPI + Streamlit + LangGraph/AutoGen 的 Researcher/Critic/Synthesizer 流水线）已被实际产品形态取代。前端已改为 Next.js 全栈应用，后端 FastAPI 与引擎模块成为未接入的遗留代码。

## 目标用户

偏好本地私有部署、想从多个差异化思维视角审视同一个问题的个人。产品以 iOS PWA 为主要使用场景，信息与文字阅读优先，适配刘海屏和 safe-area。

## 核心流程

1. 用户输入问题，选择“服务商 + 模型”；可选开启联网查证。
2. 前端通过 `useStreaming` 并发调用 `/api/chat/advisor`（每个 Agent 一个独立 SSE 请求，最多 2 个并发、800ms 错开）。
3. V2 提示词只生成 advisor / stance / core_judgment / reasoning；最终字段经过运行时校验，截断和抢救结果明确标记为部分回答。旧字段只为兼容历史保留。
4. 页面在请求开始时按配置顺序创建全部 Agent 章节；完成先后不会改变文档顺序。用户可自然滚动阅读或对单个 Agent 追问。
5. 会话按 Thread 组织，以 IndexedDB 为主、带时间戳的 localStorage 检查点为恢复兜底；支持草稿恢复与 Markdown 导出。
6. 多轮上下文保留最近 6 轮用户原文与本人成功回答，补充有界的较早用户原文；较新修正优先。其他顾问意见只在定向追问时按最近讨论取用。
7. 联网使用 Brave LLM Context 返回真实网页摘录，一次结果供全员共享；旧订阅仅支持搜索时明确标注摘要，失败状态可见。

## 当前不做（实际代码状态）

- 不再依赖 FastAPI 后端（`backend/` 与 `engines/` 为遗留，未接入）。
- 不再依赖 LangGraph / AutoGen 引擎。
- 没有数据库；数据持久化由浏览器 IndexedDB + localStorage 完成。
- 没有用户认证、云端部署以外的服务端状态管理。
- 有三条 API route：`/api/chat/advisor`（独立 SSE）、`/api/chat/models`（服务商模型列表）、`/api/chat/research`（按需检索）。早期 analysis / stream route 与主持人/分歧卡片已删除，不恢复轮次级操作。

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
- 模型绑定服务商 ID；不强制注入预设模型。默认输出预算 16384，用户请求上限允许配置，但不以模型名称或上下文长度臆测最大输出能力。
- `temperature` 默认 0.7，遇网关模型拒绝（如 kimi-k3 仅允许 1）时自动去掉该参数重试
- 单次调用超时 120s；API Key 优先级：前端传入（设置里填）> 环境变量 `OPENAI_API_KEY`；Base URL 同理（`OPENAI_BASE_URL`）
- 维持关闭 thinking 的稳定默认及参数不兼容时降级；这是先前修复 Worker CPU 超时的已确认措施。SDK 自动重试关闭，服务端统一管理重试，客户端只为网络/可重试错误兜底。
- 联网查证线上仅接受用户自己的 Brave Key；开发模式允许复用 `BRAVE_API_KEY`。不在会话快照中保存任何服务商密钥。

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
  app/api/chat/                 API Routes：advisor、models、research；shared.ts
  app/layout.tsx, page.tsx      PWA 布局与入口
  components/                   ChatApp, ChatView, AgentResponseSection,
                                InputBar, ModelSelector, SettingsModal,
                                Sidebar, IOSInstallBanner
  lib/                          advisors（人物档案）, types, storage（IndexedDB/localStorage）,
                                useStreaming, useThreads, parseStreaming, hooks,
                                advisorPrompt, conversation, judgment, modelSelection
  evals/                        固定质量题集、原提示词基线、真实模型 A/B 运行器
  public/                       PWA manifest 与图标
  __tests__/                    Vitest 单元测试
requirements.txt                遗留 Python 依赖
.env.example                    OPENAI_API_KEY 示例
```

## 架构规则

- 前端阅读文档 UI 与请求编排（`useStreaming`）分离。
- Agent 数量动态读取配置；章节顺序固定使用配置顺序，不使用完成顺序。
- 主阅读面采用单列自然滚动；底部停靠输入器，线程抽屉和设置按需出现。生成时允许草稿，中文组合输入不触发提交。
- 每个顾问独立 SSE 请求，前端并行调度（并发上限 2、错开 800ms），避免一个顾问失败拖垮全局。
- 当前 Prompt 在 `lib/advisorPrompt.ts`，生产路由与质量评测共用；`shared.ts` 保留历史兼容、上下文序列化与 JSON 解析。
- 服务端对单顾问做重试（最多 3 次）、限速退避、超时兜底（120s），解析失败时回退为「部分判断」。
- 数据迁移集中在 `lib/storage.ts`（旧 localStorage 数据 → IndexedDB，旧 analysis 格式 → 新格式）。
- 每轮快照保存有效顾问档案、顺序、模型标识和提示词版本；历史展示不依赖当前启用列表。停止/中断将原始流转成可读部分判断，定期与后台写入检查点。

## 部署

- 活跃的 Next.js 全栈应用通过 `@opennextjs/cloudflare` 部署为 Cloudflare Worker，配置位于 `frontend/wrangler.jsonc` 与 `frontend/open-next.config.ts`。
- 生产 Worker：`multi-agent-discussion-room`；workers.dev URL：`https://multi-agent-discussion-room.yk2958374240.workers.dev`。
- 模型接入保持 BYOK：浏览器设置中的 API Key 随请求提供，`OPENAI_API_KEY` / `OPENAI_BASE_URL` 只作为可选服务端回退。
- OpenNext 在 Windows 跨盘临时目录复制时不稳定；本机使用已有 `fix-cp-sync.mjs` 兼容补丁构建，标准环境可用 Linux / WSL。重复构建前使用干净的生成目录，旧产物可移至被忽略的 output/。
- 部署必须核对账户中确有既有 Worker；机器全局 Cloudflare Token 可能属于其他项目。本轮按用户要求仅推送 GitHub，未执行部署。
- 当前开发网络无法连接 `workers.dev:443`；Cloudflare API 已确认生产版本，若目标用户位于中国大陆，应绑定自定义域名并从目标网络复测。

## 当前任务（见 docs/TASKS.md）

2026-10-26 回答质量、上下文、可靠性及可选联网实现已落地，验证与凭据限制见 TASKS.md 和 QUALITY_IMPROVEMENTS.md；本轮仅更新 GitHub。
