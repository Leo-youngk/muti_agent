# 个人项目 Agent Harness v1

把本目录里的文件放到你的项目根目录即可使用。

## 文件说明

- `AGENTS.md`：给 Codex、Claude Code、Cursor 等 coding agent 的入口指令。
- `docs/EVALS.md`：验证闭环、失败处理规则和停止条件。
- `docs/TASKS.md`：当前任务和验收标准。
- `docs/PROJECT_CONTEXT.md`：稳定的产品、用户、技术栈和架构上下文。
- `docs/DECISIONS.md`：需要长期保留的技术/产品决策。
- `docs/RETROSPECTIVE.md`：把重复错误沉淀成规则。
- `prompts/agent-task.md`：每次启动 agent 任务时可直接粘贴的提示词。
- `scripts/agent-validate.ps1`：自动验证脚本，支持常见 Node 和 Python 项目。

## 使用方式

1. 把本目录所有文件复制到你的项目根目录。
2. 只填写 `USER_BRIEF.md`。
3. 启动 Codex 或 Claude Code，粘贴 `prompts/agent-task.md`。
4. 让 AI 自动补齐 `docs/PROJECT_CONTEXT.md`、`docs/TASKS.md`、`docs/EVALS.md` 和 `docs/DECISIONS.md`。
5. 要求 agent 执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/agent-validate.ps1
```

## 核心效果

这套 harness 会强制 agent 按下面的闭环工作：

```text
读取用户方向 -> AI 补齐任务和验收标准 -> 修改代码 -> 运行验证 -> 读取失败 -> 修复根因 -> 再次验证 -> 达标停止
```

不要让 agent 只说“应该可以了”。完成必须有验证证据。

## 用户职责

你只负责：

- 给方向
- 指出不能破坏的东西
- 判断最终结果是否符合你的意图

其余内容，包括任务拆解、验收标准、验证命令、文档更新和失败迭代，都交给 AI。
