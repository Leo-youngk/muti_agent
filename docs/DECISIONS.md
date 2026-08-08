# 决策记录

## 2026-08-05：主界面采用文字优先的 iOS 阅读文档

决策：产品对外定位为“多 Agent 讨论室”，不是独立品牌。主界面以问题和 Agent 正文为核心，采用单列自然滚动；每位 Agent 是文档章节而不是卡片。保留结构化小标题，但默认展开全部非空内容。输入器、线程抽屉和设置只在用户需要时出现。

顺序与数量：Agent 数量来自配置，可为 1 个或更多；每轮开始即按配置顺序创建章节，完成先后不改变展示顺序。单 Agent 时隐藏不适用的“发起下一轮讨论”入口。

原因：主要使用环境是 iOS PWA，用户明确以信息和文字阅读为核心。卡片、头像、徽标、常驻输入框和进度面板会切碎连续阅读并挤压有限的移动端空间。

影响：`AgentResponseSection` 取代主流中的 `AdvisorCard`；`ChatView` 负责文档流与自然滚动；`InputBar` 改为按需底部层；PWA 名称和图标改为中立的讨论室语义。内部历史类型仍保留 `advisor` 命名以避免无关数据迁移。

---

## 架构演进决策（代码现状）

### 前端从 Streamlit 迁往 Next.js 16 全栈（PWA）

决策：前端已从最初的 Streamlit 迁移到 Next.js 16（App Router）+ React 18 + TypeScript + Tailwind，并做成移动优先的 PWA（支持 iOS 安装、刘海屏 safe-area 适配）。

原因：需要更细粒度的 token 级流式渲染、按顾问的独立状态管理、浏览器端 IndexedDB 持久化和移动端体验，Streamlit 无法满足。

影响：`USER_BRIEF.md` 中「前端使用 Streamlit」的要求已被取代。原 `frontend/app.py` 已不存在。

---

### 核心交互从 Researcher/Critic/Synthesizer 改为「名人顾问团」

决策：不再使用 Researcher → Critic → Synthesizer 的流水线角色，改为多个以真实人物（乔布斯、马斯克、巴菲特、芒格）角色扮演的「顾问」，各自独立返回结构化判断（立场 / 核心判断 / 推理 / 批评 / 盲点），用户可单独追问或发起全员辩论。

原因：让多个有鲜明、可预期思维差异的角色并行给出判断，比串联流水线更能体现「多视角碰撞」；角色扮演 prompt 能稳定产出差异化回答。

影响：引擎层（LangGraph / AutoGen）不再承载该交互，`engines/` 与 `backend/` 成为遗留。

---

### 每个顾问独立 SSE 请求，前端并行调度

决策：每个顾问使用一个独立 `/api/chat/advisor` SSE 请求，前端用 `useStreaming` 以并发上限 2、800ms 错开的策略并行发起，而不是把整个面板做成单流。

原因：单流中一个顾问失败会阻塞全局；独立请求可让每个顾问独立完成 / 失败 / 单独重试，且便于按顾问管理 abort。

影响：前端需自行管理多个 fetch 的生命周期与 abort；`/api/chat/stream`（整面板单流）被闲置。

---

### 数据持久化由浏览器完成（IndexedDB + localStorage）

决策：Thread 与设置保存在浏览器端。对话历史用 IndexedDB（`idb-keyval`，容量大），设置用 localStorage；两者都做了旧数据迁移。

原因：本地私有部署、无服务端数据库；浏览器存储满足单机使用且免部署。

影响：换浏览器 / 清缓存会丢失数据；无服务端历史。

---

### 多模型 / 多服务商，由模型名驱动 max_tokens

决策：不固定单一 OpenAI gpt-4o，改为可在设置中配置多个 Provider（DeepSeek / OpenAI / 硅基流动 / 火山引擎 / 自定义），每个 Provider 有独立 baseUrl、apiKey、模型列表；服务端按模型名前缀设置不同的 `max_tokens`。

原因：面向国内用户实际可用模型，且不同模型上下文上限差异大，避免输出被截断。

影响：API Key 与 baseUrl 前端可填，回退到环境变量 `OPENAI_API_KEY` / `OPENAI_BASE_URL`。

---

### JSON 容错解析与流式字段提取

决策：统一在 `shared.ts` / `parseStreaming.ts` 中做健壮 JSON 解析：去 `thinking` 块、markdown 围栏、全角引号、修复换行、去尾逗号、取最外层 `{}`；流式时实时提取已完成的字段先行渲染，输出中断时回退「部分判断」。

原因：不同模型（尤其 DeepSeek 推理模型）输出格式不稳定，直接 `JSON.parse` 极易失败，需多级容错。

影响：解析逻辑集中在 `lib/parseStreaming.ts` 与 `app/api/chat/shared.ts`，有对应单测。

---

### 使用 OpenNext 部署到 Cloudflare Workers，保留 BYOK

决策：活跃的 `frontend/` 使用 `@opennextjs/cloudflare` 与 Wrangler 部署为 Cloudflare Worker，而不是 Cloudflare Pages。生产环境继续采用 BYOK，模型密钥由 PWA 设置按请求提供，不强制把模型 Key 集中保存为 Worker Secret。

原因：项目包含 Next.js App Router Route Handlers 与 SSE，需要完整的服务端 Worker 运行时；BYOK 与当前本地优先、无账号体系的产品边界一致，也避免集中托管用户模型凭据。

影响：部署入口为 `.open-next/worker.js`，静态资源由 `ASSETS` binding 提供；Windows 本机构建使用官方推荐的 WSL 环境。workers.dev 在部分网络不可达时，需要另行绑定自定义域名。

---

## 遗留决策（历史，已不适用）

以下为原始实现阶段的决策，当前前端主流程已不再依赖，保留仅供追溯：

- ~~使用 LangGraph `astream_events` 实现 token 流~~（引擎已弃用）
- ~~AutoGen monkey-patch / RoundRobinGroupChat~~（引擎已弃用）
- ~~FastAPI + sse-starlette 提供 `/api/chat/stream`~~（后端已弃用）
- ~~会话历史仅保存在后端内存~~（已改为浏览器持久化）
