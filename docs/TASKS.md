# 任务

## 当前任务

状态：completed

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
