# 任务

## 当前任务

状态：completed

来源：`USER_BRIEF.md`

### AI 推断的用户目标

构建一个可本地运行的多 Agent 对话 Web 应用，支持 LangGraph 和 AutoGen 两种引擎，三个 Agent 实时协作并流式展示结果，UI 简洁美观（Apple/Claude 风格）。

### 验收标准

- [x] 目录结构包含 backend/、engines/、frontend/、shared/
- [x] FastAPI 后端提供 `/api/chat/stream` SSE 端点
- [x] LangGraph 引擎实现三节点图（Researcher → Critic → Synthesizer），token 级流式
- [x] AutoGen 引擎实现 GroupChat，消息级流式（逐词模拟）
- [x] 前端可切换引擎（LangGraph / AutoGen）
- [x] 支持创建和切换多个 Thread
- [x] 实时显示每个 Agent 的发言，区分颜色和状态
- [x] 后端处理缺少 API Key、空任务、不支持引擎等错误
- [x] 前端显示错误提示
- [x] 提供 requirements.txt 和 .env.example

### 必须验证

- 运行 `powershell -ExecutionPolicy Bypass -File scripts/agent-validate.ps1`

### 约束

- 不引入不必要的依赖
- 不持久化存储
- 保持引擎模块独立

## 待办列表

- 可选：添加流式终止按钮
- 可选：支持导出对话记录
- 可选：支持自定义 Agent 角色和 prompt
