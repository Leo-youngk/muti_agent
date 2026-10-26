# 多 Agent 讨论室

个人使用、移动优先的多顾问对话应用。输入一个问题，多位内置或自定义顾问按各自思维方式给出判断，支持实时输出和定向追问。

活跃应用位于 `frontend/`：Next.js 16、React、TypeScript、OpenAI 兼容 SDK、SSE。历史与设置保存在当前浏览器，PWA 支持添加到 iPhone 主屏幕。原 `backend/`、`engines/` 是未接入的历史实现。

## 本地运行

```powershell
cd frontend
npm ci
npm run dev
```

在设置中添加模型服务商、Base URL 和 API Key，加载并选择服务商实际支持的模型。模型选择同时绑定服务商身份，同名模型可以独立使用。也可通过被 Git 忽略的环境配置提供 `OPENAI_API_KEY`、`OPENAI_BASE_URL`，作为服务端回退。

## 对话能力

- 人物风格保留在判断尺度与语言中；回答突出用户条件、依据、适用前提和下一步。
- 保存最近多轮问答与较早用户原文，较新修正优先；定向追问可参考同一轮其他顾问意见。
- 区分排队、生成、完成、部分回答、停止和失败；单顾问重试保留之前可读的内容。
- 每轮保存顾问与模型快照，调整当前顾问开关不会隐藏历史。
- 生成时可写草稿；草稿按线程恢复；切后台保存可读的部分正文。
- 可导出 Markdown。浏览器本地数据不进行跨设备云同步。

## 可选联网查证

在设置的“联网查证”中填写自己的 Brave Search API Key，然后点输入栏“联网”。每次提问只检索一次，网页摘录供本轮全部顾问共享。结果中明确区分网页摘录、仅搜索摘要和查证失败。

生产环境使用用户提供的检索密钥；开发模式可读取本机已有 `BRAVE_API_KEY`。检索密钥不进入对话历史或日志。

## 验证与质量评测

```powershell
npm run test -- --maxWorkers=4
npx tsc --noEmit
npm run lint
npm run build
npm run eval:quality -- --dry-run
```

内容质量评测需要 Node.js 22.6+ 和真实可用的模型凭据，见 [评测说明](frontend/evals/README.md)。题集包含 24 个固定场景，保留旧提示词与 V2 的成对比较；单测通过不代替真实模型质量评测。

## 开发记录

产品与架构见 [PROJECT_CONTEXT](docs/PROJECT_CONTEXT.md)，本轮验收见 [QUALITY_IMPROVEMENTS](docs/QUALITY_IMPROVEMENTS.md)。Agent 工作流程、任务和验证规则分别位于 `AGENTS.md`、`docs/TASKS.md`、`docs/EVALS.md`；原始用户设想保留在 `USER_BRIEF.md`。

2026-10-26 本轮改动提交至 GitHub，按用户要求未部署，线上版本保持原状。项目保留 OpenNext / Cloudflare Workers 配置，既有部署记录见 [TASKS](docs/TASKS.md)。
