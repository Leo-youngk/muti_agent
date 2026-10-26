# Agent 信息流精简与轮次操作移除计划

## Summary

精简每个 Agent 的回答信息流，突出用户真正需要阅读的内容：立场、核心判断和推理；删除盲点及其他次要字段的展示，不使用横线分隔 Agent，改为连续、轻量的纵向阅读流。同时完整移除“继续讨论”“重新生成本轮”“发起下一轮讨论”三个入口及其前端回调链路和请求编排逻辑，保留单个 Agent 的追问、复制和失败重试能力。

## Current State Analysis

- [ChatView.tsx](../../../frontend/components/ChatView.tsx) 当前按消息渲染多个 Agent，并在最后一个面板底部展示三个轮次操作按钮；同时接收未使用的 `onStartDiscussion`。
- [AgentResponseSection.tsx](../../../frontend/components/AgentResponseSection.tsx) 当前展示 `groupJudgmentSections` 返回的主字段和折叠次要字段，Agent 区块使用 `border-t` 分隔，底部保留追问/复制操作。
- [discussionPresentation.ts](../../../frontend/lib/discussionPresentation.ts) 当前字段配置包含核心判断、推理、核心批评、关注焦点、要求改变、如何切入、盲点；其中后四项被归入折叠区域。
- [ChatApp.tsx](../../../frontend/components/ChatApp.tsx) 将 `handleRegenerate`、`handleDebate`、`openGeneralComposer` 传给 `ChatView`，其中 `openGeneralComposer` 还用于空状态入口；当前空状态已是空白，因此 `onStartDiscussion` 属于遗留接口。
- [useStreaming.ts](../../../frontend/lib/useStreaming.ts) 仍实现 `handleRegenerate` 和 `handleDebate`，分别会原地重生成面板或追加 debate 面板；用户要求“连功能一起移除”，这些导出和对应编排代码应删除。
- [types.ts](../../../frontend/lib/types.ts) 的 `AdvisorJudgment` 保留旧字段是为了兼容已有本地历史数据和模型返回，不在本次删除数据字段，避免历史数据迁移风险；展示层不再呈现这些字段。

## Proposed Changes

### 1. 精简字段展示

文件：[discussionPresentation.ts](../../../frontend/lib/discussionPresentation.ts)

- 将可见字段收敛为 `core_judgment` 与 `reasoning`。
- 保留 `stance` 作为 Agent 标题旁的轻量标签，不把它重复渲染成独立大块。
- 移除 `criticism`、`focus`、`demand`、`approach`、`blind_spot` 的展示配置；旧 JSON 中即使存在这些字段，也只忽略不渲染。
- 让 `groupJudgmentSections` 返回结构保持稳定，减少组件改动和历史测试影响；`secondary` 为空时不渲染折叠控件。

文件：[AgentResponseSection.tsx](../../../frontend/components/AgentResponseSection.tsx)

- 保留 Agent 编号、名称、立场、核心判断、推理、思考中/失败状态。
- 去掉 Agent 区块的 `border-t`，通过统一的垂直间距区分相邻 Agent，不使用线段分隔。
- 保留“追问此 Agent”“复制回答”和单 Agent 失败重试，因为它们是局部操作，不属于用户要求删除的三个轮次操作。
- 复制内容只拼接当前可见的立场、核心判断、推理，避免复制出界面隐藏字段。
- 保持流式字段提取逻辑不变，避免影响实时回答。

### 2. 删除三个轮次操作及回调

文件：[ChatView.tsx](../../../frontend/components/ChatView.tsx)

- 删除 `onStartDiscussion`、`onContinueDiscussion`、`onRegenerate`、`onDebate` 相关 Props 和解构参数。
- 删除最后一个面板底部的三个按钮及 `allSettled`、`isLastPanel` 仅为这些按钮服务的条件分支；保留 Agent 级 `canAct` 判断。
- 删除空状态相关遗留入口逻辑，继续保持空会话无引导文案。
- 简化面板头部，仅保留必要的追问/辩论元信息；不新增花哨卡片或分割线。

文件：[ChatApp.tsx](../../../frontend/components/ChatApp.tsx)

- 删除 `openGeneralComposer`、`handleRegenerate`、`handleDebate` 及其 `useStreaming` 解构引用。
- 从 `ChatView` 调用中移除对应三个 props。
- 保留输入框聚焦、单 Agent 追问、单 Agent 重试、线程切换和设置入口。

文件：[useStreaming.ts](../../../frontend/lib/useStreaming.ts)

- 从 hook 中删除 `handleRegenerate` 和 `handleDebate` 两段完整实现及其只被这两段使用的依赖。
- 从返回对象删除两个 handler。
- 不改动普通提交、单 Agent 追问、单 Agent 重试、停止和流式刷新逻辑。
- 不删除 `isDebateRound` 等历史数据字段，保证旧线程可以正常读取；旧辩论面板只按普通 Agent 内容展示。

### 3. 同步测试与文档

文件：[ChatView.test.tsx](../../../frontend/__tests__/ChatView.test.tsx)、[AgentResponseSection.test.tsx](../../../frontend/__tests__/AgentResponseSection.test.tsx)、[discussionPresentation.test.ts](../../../frontend/__tests__/discussionPresentation.test.ts)

- 更新组件测试 props，使其符合删除后的接口。
- 增加/调整断言：只渲染立场、核心判断、推理；盲点、批评等字段不出现在展示文本；三个轮次按钮不存在；Agent 之间无边框分隔样式。
- 保留并验证追问、复制、错误重试和流式状态。

文件：[docs/TASKS.md](../../TASKS.md)、[docs/PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md)

- 记录本次信息流和操作入口变化，说明轮次级继续/重生成/辩论流程已移除，避免后续维护者重新接回已删除入口。

## Assumptions & Decisions

- “连功能一起移除”解释为删除前端按钮、回调和 `useStreaming` 中对应的动作实现；不删除历史消息类型字段，以兼容已有 IndexedDB/localStorage 数据。
- “他们风格的回答”由现有 Agent profile 继续控制，不新增新的模型字段或视觉装饰；用户要求优先核心判断，因此不引入卡片、时间线、横向步骤等花哨结构。
- 默认展示顺序为：Agent 标识与立场 → 核心判断 → 推理 → 局部操作。Agent 间使用留白，不使用横线。
- “盲点可以删掉”按展示和复制内容删除处理；后端 prompt/模型 JSON 契约暂不改，避免让不同服务商的旧返回格式导致解析失败。
- 不新增依赖、不改变 API、不改变 SSE 调度和线程存储。

## Verification

在 `frontend/` 目录执行：

1. `npm run test`
2. `npx tsc --noEmit`
3. `npm run build`
4. 启动 `npm run dev`，检查桌面和 320/390/430 宽度移动布局。
5. 手动验证：普通多 Agent 回答只显示立场/核心判断/推理；Agent 之间无分割线；页面不存在三个已删除按钮；单 Agent 追问、复制、错误重试仍可用；旧历史面板能正常打开。

验收标准：测试、类型检查和构建全部通过；核心信息流变短且无横向溢出；三个轮次动作不再能从当前 UI 或 ChatApp/useStreaming 调用链触发。
