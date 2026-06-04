

## 我想做什么


请完整开发一个【多 Agent 对话 Web 应用】。

项目目标：
构建一个本地可运行的 Web 应用，支持用户输入任务描述，并让多个 AI Agent 围绕该任务进行实时协作对话。前端需要支持在两种多 Agent 引擎之间切换：LangGraph 和 AutoGen。

技术栈：
- 后端：FastAPI
- 前端：Streamlit
- 多 Agent 框架：LangGraph 和 AutoGen 都需要集成
- 模型：OpenAI gpt-4o
- OpenAI API Key 从环境变量读取

默认 Agent 角色：
1. Researcher：负责理解任务、提出初步分析和解决思路
2. Critic：负责审查 Researcher 的输出，指出问题、风险、遗漏和可改进点
3. Synthesizer：负责整合 Researcher 和 Critic 的内容，形成更清晰、完整、可执行的最终回复

核心功能：
1. 前端侧边栏可以选择使用 LangGraph 或 AutoGen 引擎
2. 用户可以输入任务描述 Task，并提交给后端
3. 系统根据选择的引擎启动多 Agent 对话
4. 前端需要实时流式显示每个 Agent 的回复内容
5. 不同 Agent 的发言需要在界面上清楚区分
6. 支持 thread_id，用于区分不同对话线程
7. 支持同时创建和切换多个对话线程
8. 后端需要保存每个 thread_id 对应的基础对话历史
9. 需要包含基础错误处理和用户提示

流式输出要求：
- 用户提交任务后，不应等所有 Agent 完成后才显示结果
- 每个 Agent 生成内容时，前端应尽可能实时展示
- 流式消息中应能区分当前输出来自哪个 Agent
- 当某个 Agent 完成输出时，应有明确状态
- 当整个多 Agent 对话完成时，应有明确结束状态

后端要求：
- 使用 FastAPI 提供接口
- 需要有一个统一的对话入口，能够根据 engine 参数调用 LangGraph 或 AutoGen
- LangGraph 和 AutoGen 的实现应封装在独立模块中
- 后端需要处理：
  - 缺少 OPENAI_API_KEY
  - 用户输入为空
  - 不支持的 engine 类型
  - 模型调用失败
  - 多 Agent 执行失败

前端要求：
- 使用 Streamlit 实现
- 页面需要包含：
  - engine 选择器
  - thread_id 创建/选择区域
  - Task 输入框
  - 提交按钮
  - 实时对话展示区域
  - 错误提示区域
- 展示时需要清楚标识 Agent 名称，例如 Researcher、Critic、Synthesizer
- 用户体验应简洁清晰，优先保证功能稳定

项目结构要求：
请使用清晰的目录结构，至少包含：
- backend/
- frontend/
- engines/
- shared/ 或 common/
- .env.example
- requirements.txt
- README.md
