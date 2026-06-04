# Agent 任务提示词

请先阅读 `AGENTS.md`，然后根据 `USER_BRIEF.md` 完成当前任务。

用户只负责方向和必要边界。你负责自动补齐项目上下文、任务拆解、验收标准、验证方案和文档更新。

严格使用以下流程：

1. 阅读 `USER_BRIEF.md`、`docs/PROJECT_CONTEXT.md`、`docs/TASKS.md`、`docs/EVALS.md` 和 `docs/DECISIONS.md`。
2. 检查项目结构、README、配置文件和相关源码，自动补齐或修订 `docs/PROJECT_CONTEXT.md`。
3. 把 `USER_BRIEF.md` 转成 `docs/TASKS.md` 中的具体任务、验收标准、约束和假设。
4. 如果 `docs/EVALS.md` 不适合当前项目，先补齐可执行验证方式。
5. 修改前先检查与任务相关的文件。
6. 做最小、聚焦的改动。
7. 运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/agent-validate.ps1
```

8. 如果验证失败，诊断根因，修复最小问题，然后重新验证。
9. 最多重复 5 轮“修复-验证”循环。
10. 只有验证通过，或存在真实阻塞时，才停止。

最终回复必须包含：

- 修改了哪些文件
- AI 自动补齐了哪些任务/验收标准/假设
- 哪些验收标准已验证
- 运行了哪些验证命令
- 验证结果
- 剩余风险或阻塞

没有验证证据时，不要声明任务完成。
