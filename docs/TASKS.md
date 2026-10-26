# 任务

## 当前任务

状态：completed

### 2026-10-26 回答质量、连续对话与可靠性

范围与验收：[QUALITY_IMPROVEMENTS.md](QUALITY_IMPROVEMENTS.md)。

- [x] 提示词 V2 与有界多轮上下文
- [x] 运行时结果校验、部分回答状态、停止和重试保留内容
- [x] 服务商与模型身份、旧选择迁移，移除强制补入模型
- [x] 每轮顾问快照与历史稳定显示
- [x] 草稿、中文输入法、后台持久化与恢复
- [x] 24 题固定内容评测、原提示词基线及真实 A/B 运行器
- [x] 联网接口、共享资料、引用和显式降级；成功路径使用受控 fixture 验证
- [x] 自动检查、浏览器验收与 GitHub 提交；按用户最新要求不部署

验证证据：14 个 Vitest 文件、66 项测试通过；`npx tsc --noEmit`、`npm run lint`、`npm run build` 通过。OpenNext 产物构建成功；本地 workerd 首页/manifest 为 200，缺少 BYOK 的 advisor/research 返回受控 400。

Playwright Chromium 验证：320 / 375 / 390 / 430 手机视口与 1280 桌面无横向溢出；1 / 4 / 10 位顾问顺序；同名模型第二家服务商路由；生成时写草稿；组合输入不发送；隐藏顾问后的历史与追问；共享一次查证；停止后重开保留内容。验收使用明确标注的测试 SSE 与资料，不作为真实模型回答；未做 iPhone 真机验收。

外部验证限制：本机未发现可用模型凭据，真实内容 A/B 未执行。已有 Brave 凭据被真实服务返回 `SUBSCRIPTION_TOKEN_INVALID`，未取得真实检索成功结果；失效密钥与检索失败的可见降级已验证，联网默认关闭。需要有效的用户 BYOK 后才能完成这些外部服务实测。

### 2026-08-06 修复 Windows 部署并发布 Cloudflare Worker

- [x] 根因一：`@opennextjs/aws` 包损坏（缺 `package.json` / `logger.js`），`npm install` 修复。
- [x] 根因二：Node v24 的 `fs.cpSync` 在 Windows 上复制 C 盘临时目录 → E 盘中文路径时崩溃（EIO / Access denied），OpenNext 的 `initOutputDir` 无法把编译好的 config 复制进 `.open-next/.build`。用本地脚本 `frontend/fix-cp-sync.mjs` 预加载给 `fs.cpSync` 打猴子补丁（内部改走 `copyFileSync` 递归），已验证生效。
- [x] 根因三：OpenNext 的 `compileEnvFiles` 用 `appendFileSync` 写 `next-env.mjs`，`.open-next` 残留导致重复导出（`Multiple exports with the same name`），部署前删除 `.open-next` 干净重建解决。
- [x] 全部在 Windows 本机完成（未使用 WSL），凭证为本机 `wrangler whoami`（yk2958374240@gmail.com，OAuth Token）。
- [x] 已发布：`https://multi-agent-discussion-room.yk2958374240.workers.dev`（Version 6fd0ffcf），首页与 manifest 均 HTTP 200。

以后重新部署的命令（Windows 本机）：

```powershell
cd frontend
Remove-Item .open-next -Recurse -Force          # 清残留（否则 next-env.mjs 重复导出）
node --import ./fix-cp-sync.mjs node_modules/@opennextjs/cloudflare/dist/cli/index.js build
node --import ./fix-cp-sync.mjs node_modules/@opennextjs/cloudflare/dist/cli/index.js deploy
```

### 2026-08-05 Agent 信息流精简与轮次操作移除

- [x] Agent 回答只保留立场、核心判断和推理，隐藏批评、关注点、要求改变、切入方式与盲点。
- [x] 去掉 Agent 之间的横线分隔，改为依靠留白维持连续阅读。
- [x] 删除“继续讨论”“重新生成本轮”“发起下一轮讨论”按钮及其 ChatApp/useStreaming 调用链路。
- [x] 保留单 Agent 追问、复制回答、失败重试和流式回答。
- [x] 保留旧类型和历史数据字段，避免已有 IndexedDB/localStorage 数据迁移风险；旧辩论面板按普通 Agent 内容展示。

验收结果：以归档计划 [2026-08-05-agent-flow-cleanup-plan.md](superpowers/plans/2026-08-05-agent-flow-cleanup-plan.md) 为准，完成后运行 Vitest、tsc 和 Next build。

### 2026-08-05 DeepSeek 式移动端 UI + 设置页滑块 + 模型自动加载

- [x] 设置页改为移动端底部抽屉（`zen-sheet` 上滑动画），桌面端保持居中弹窗，手机端顶部有拖拽把手。
- [x] 高级参数改为滑块（温度 0~1.2 / 单次输出上限 4K~64K / 超时 30s~300s），温度带「自动」开关；滑块样式（`zen-range`）为 DeepSeek 风格细轨道 + 圆形滑块。
- [x] 新增 `/api/chat/models` 接口：代理服务商 `GET {baseURL}/models`（兼容 OpenAI `data[].id`、字符串数组、`models[]` 三种返回格式），带鉴权头、20s 超时、友好错误（无效 URL / 401 / 404 / 超时 / 网络失败）。
- [x] 设置页 Base URL 失焦自动加载模型列表（仅当该服务商模型列表为空时），加载结果以可点击芯片展示（深色=已加入，浅色=未加入，点击切换 ✓/+），不再需要手输模型名；保留折叠的手动添加作为兜底。
- [x] 输入栏改为 DeepSeek 式：圆角容器 + 圆形发送/停止按钮（有内容时深色箭头，生成中变停止方块）。
- [x] 模型选择器移到左下角「深度思考」位置：药丸按钮，显示当前模型名，点击上拉选择；取消原来输入栏底部下划线样式。
- [x] 顶部导航简化为 DeepSeek App 风格：左侧「=」打开历史记录抽屉，中间轻量标题，右侧「+」新建对话。
- [x] 历史记录抽屉（原 Sidebar）改为 App 式侧滑：顶部搜索框、按「今天 / 昨天 / 近 7 天 / 更早」分组、当前项高亮、每项带消息图标。

验收结果：Vitest 44/44 通过；`tsc --noEmit` 通过；`next build` 通过。E2E：`/api/chat/models` 用用户 opencode zen 网关实测返回 25 个模型；非法 URL/空 URL/不存在的域名均返回清晰错误；页面 HTTP 200。

### 2026-08-05 空状态、设置入口与主题颜色

- [x] 删除空会话中的“开始一个讨论 / 提出一个问题”引导文案与按钮，保留干净对话区。
- [x] 设置入口移到历史记录抽屉左下角，输入栏不再重复放置设置按钮。
- [x] 新增 5 个主题颜色：鼠尾草、海洋、午夜、玫瑰、琥珀；主题保存到 localStorage，刷新后保持。
- [x] 设置页 API 配置 Tab 增加主题颜色快捷选择。

验收结果：`tsc --noEmit`、Vitest 44/44、`next build` 通过；本地页面 HTTP 200。

### 2026-08-05 修复「经常回复失败」：推理模型输出截断 / temperature 兼容 / 慢模型超时

使用 `https://opencode.ai/zen/go/v1` 网关（用户提供 Key）实测复现并修复三处导致回复失败的根因，改动仅限 `frontend/app/api/chat/advisor/route.ts`：

- [x] `max_tokens` 封顶 4096 → 16384：推理型模型（deepseek-v4-flash / qwen3.7-plus / glm-5.2 等）会先输出数千 token 思考内容，复杂任务下 4096 预算被推理耗尽（finish_reason=length），正式 JSON 被截断导致解析失败/空内容。实测同一复杂任务：4096 时 content 仅 1024 字符且截断，16384 时 finish=stop、JSON 完整闭合。
- [x] 硬编码 `temperature: 0.7` 改为可降级：网关 kimi-k3 仅允许 temperature=1，0.7 必返回 400「invalid temperature」。首次失败且错误信息含 "temperature" 时去掉该参数重试，不消耗重试次数。
- [x] 服务端单次调用超时 90s → 120s：实测 glm-5.2 简单问题约 65s，旧超时会把慢网关的正常回答判死。

验收结果：44 项 Vitest 通过；`tsc --noEmit` 通过；`next build` 通过；route.ts / shared.ts ESLint 无错误。dev server 下用该网关 + deepseek-v4-flash + 复杂任务 E2E 通过（返回完整判断、无 error）；不支持的模型名（如 gpt-4o）返回清晰错误 `HTTP 401: Model gpt-4o is not supported`。
注意：仓库级 `npm run lint` 会扫描 `.open-next/` 构建产物并报大量历史错误，与本次改动无关。

补充（配置层面，非代码 bug）：该网关支持的模型为 deepseek-v4-flash / deepseek-v4-pro / qwen3.7-plus 系列 / glm-5.x / kimi-k3 系列 / minimax-m3 系列 / gpt-5.6-luna / grok-4.5 等；OpenAI 预设里的 gpt-4o、DeepSeek 预设里的 deepseek-chat 在此网关不存在，选中会 401 失败，需在设置里改用网关支持的模型名。

### 2026-08-05 对话式排版（参考 Claude / DeepSeek App）

在紧凑密度基础上，按用户要求引入两个 App 的排版惯例。**本次推翻了「文字优先 iOS PWA 界面重构」中的三条验收标准**，相应单测已改写：

- [x] 核心判断与推理不再各占一行小标题——20px 半粗体与 16px 正文的层级已足够区分（原标准：保留结构化小标题）
- [x] 关注焦点 / 要求改变 / 如何切入 / 盲点收进 DeepSeek 式「展开完整判断 · N 项」折叠块，带左细线与旋转箭头；无次要字段时不渲染折叠控件（原标准：默认展示全部非空字段、无展开控件）
- [x] 用户问题改为右对齐气泡（15px、`--bubble` 新增令牌），不再是 19px 满宽标题（原标准：`text-[19px]`）
- [x] 操作行降到 13px、`mt-2 -mb-2` 回收视觉高度，触控目标仍为 44px
- [x] 字段分组逻辑下沉到 `lib/discussionPresentation.ts` 的 `groupJudgmentSections`，组件只负责呈现

验收结果：390×844、四 Agent × 七字段的会话，正文容器 3097px，纯空隙占比 27.4%、文字占比 73.0%（密度调整前为 44.3% / 49.6%）。仅折叠次要字段一项即从 4441px 降到 3097px（−30.3%）。320/390/430 均无横向溢出，气泡与折叠控件不换行，12 个触控目标全部 44px。tsc / 42 项 Vitest / ESLint 通过，控制台无错误。

说明：此前设计文档存在冲突——`docs/DESIGN.md` §6 主张渐进式展开，而本文件上一版任务要求默认全展开。本次按用户指示采用前者。

### 2026-08-05 紧凑阅读密度落地

`docs/superpowers/specs/2026-08-05-compact-reading-density-design.md` 此前只提交了设计稿（commit e39a32d 未改动任何前端代码），本次将其落到 `AgentResponseSection` 与 `ChatView`。

- [x] Agent 章节 `py-10`→`py-7`、标题区 `mb-8`→`mb-5`、字段间距 `space-y-7`→`space-y-5`、小标题 `mb-2`→`mb-1`
- [x] 正文行高 `leading-7`(28px)→`leading-[26px]`；核心判断保持 `leading-[1.55]` 强调层级
- [x] Markdown 段落与列表底距 `mb-3`→`mb-2`
- [x] 立场从独立一行改为与序号、姓名同基线排列，回收标题行右侧约 260px 空白
- [x] 外层节奏：用户问题 `mb-10`→`mb-7`、讨论轮 `mb-12`→`mb-8`、底部操作区 `py-10`→`py-7`、容器 `pb-24 pt-7`→`pb-20 pt-6`

验收结果：390×844 下同一条四 Agent 会话，正文容器高度 3836px→3214px（−16.2%），纯空隙占比 44.3%→37.3%，文字占比 49.6%→57.1%，Agent 标题区 53px→26px。320/390/430 宽度均无横向溢出，按钮触控目标保持 44px；字号、内容结构、章节顺序、滚动与流式行为未改动。tsc / 38 项 Vitest / ESLint 均通过，控制台无错误。

### 2026-08-05 Cloudflare Workers 部署

- [x] 使用 `@opennextjs/cloudflare` 将 `frontend/` 适配为 Cloudflare Worker
- [x] 增加可版本控制的 Wrangler、OpenNext、预览与部署配置
- [x] 在 `workerd` 运行时验证首页、静态资源和 API Route
- [x] 保持 BYOK 模式：模型密钥由 PWA 设置按请求提供，Cloudflare 服务端密钥仅作为可选回退
- [x] 部署到 `*.workers.dev`；Cloudflare API 已确认生产版本，公网 HTTP 回读受当前网络阻断

验收结果：Worker 已发布到 `https://multi-agent-discussion-room.yk2958374240.workers.dev`；本地 workerd 中首页与 manifest 返回 200，`/api/chat/advisor` 缺少 BYOK Key 时返回受控的 400 JSON；Cloudflare 生产流量 100% 指向版本 `edc671ca-b29b-42f0-b8e1-436778bd719a`。当前 Windows/WSL 网络无法连接 `workers.dev:443`，因此未在本机完成生产 URL 的 HTTP 回读；中国大陆稳定访问可能需要绑定自定义域名。

来源：`USER_BRIEF.md`（原始设想），已演进为「顾问团」产品形态。

### 2026-08-05 文字优先 iOS PWA 界面重构

- [x] 主界面改为单列阅读文档：问题在前，Agent 完整回答按配置顺序自然展开
- [x] Agent 数量不固定；已覆盖 1、4、10 个 Agent 的排序与呈现规则
- [x] 移除主阅读流中的头像、卡片、胶囊、进度面板和常驻输入框
- [x] 保留结构化小标题，默认展示全部非空字段，正文可选择复制
- [x] 输入器改为按需底部层；新问题、继续讨论和指定 Agent 追问均可打开
- [x] 流式更新不强制抢滚动位置，离开底部时只显示低干扰「查看新内容」
- [x] 线程抽屉、模型选择器、安装提示和 PWA 图标统一为中立的讨论室语义
- [x] iPhone 320 / 375 / 390 / 430 宽度浏览器验收无横向溢出
- [x] 完整四 Agent 流程、单 Agent 流程、追问入口与控制台无错误均已验证

验收标准：以信息和文字为绝对主角；自然滚动；章节顺序固定但数量动态；主阅读面不被持续交互控件占据。

### 实际已实现的核心功能（对照代码）

- [x] Next.js 16 全栈前端（React + TS + Tailwind + PWA），非 Streamlit
- [x] 四位内置「顾问」角色扮演（乔布斯 / 马斯克 / 巴菲特 / 芒格），各带独立性格档案
- [x] 每个顾问独立 SSE 流式输出结构化 JSON 判断（立场 / 核心判断 / 推理 / 批评 / 盲点）
- [x] token 级实时渲染，thinking → done / error 状态机，失败可单独重试
- [x] 对单个顾问「追问」（follow-up），带上其他顾问立场做针对性回应
- [x] 「深入辩论」轮（debate），顾问互相审阅判断后修正立场
- [x] 主持人交叉分析 route（`/api/chat/analysis`）与展示组件 `ConclusionSection`（当前未接线）
- [x] 多 Thread 会话，IndexedDB + localStorage 持久化，可重命名 / 删除 / 导出 Markdown
- [x] 多模型 / 多服务商配置（DeepSeek / OpenAI / 硅基流动 / 火山引擎 / 自定义），模型名驱动 max_tokens
- [x] API Key 多级回退（前端配置 > 环境变量）
- [x] 服务端重试、限速退避、超时兜底、部分 JSON 回退解析
- [x] Vitest 单元测试（parseJSON / extractPartial / buildHistory / extractStreamingFields）

### 遗留但未接入（不再作为当前能力）

- [ ] FastAPI 后端 `backend/main.py`
- [ ] LangGraph 引擎 `engines/langgraph_engine.py`
- [ ] AutoGen 引擎 `engines/autogen_engine.py`
- [ ] Python `requirements.txt`（供以上遗留代码）
- [ ] `/api/chat/stream`（整面板单流）、`/api/chat/analysis`（主持人）route 尚未接入 `useStreaming` 主流程

## 待办列表（可选增强项）

- [ ] 将交叉分析（主持人结论）接入 `useStreaming` 主流程，启用 `ConclusionSection`
- [ ] 清理或明确废弃 FastAPI 后端与 LangGraph / AutoGen 引擎（避免混淆）
- [ ] 删除未使用的 `frontend/lib/stream.ts` 与 `/api/chat/stream` route 或接入复用
- [ ] 补充 advisor / analysis route 的服务端单测
- [ ] 将 `agent-validate.ps1` 适配为指向 `frontend/` 子目录（当前在根目录运行检测不到命令）
- [ ] 独立安全维护任务：升级 Next.js / PostCSS / Sharp 到修复 `npm audit --omit=dev` 所报高危公告的兼容版本，并单独做回归验证
