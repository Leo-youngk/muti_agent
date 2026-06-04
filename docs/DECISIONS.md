# 决策记录

## 2026-06-04 - LangGraph 使用 astream_events 实现 token 流

决策：在 LangGraph 引擎中使用 `app.astream_events(state, version="v2")` 获取事件流，通过 `on_chat_model_stream` 事件捕获 token，通过 `langgraph_node` metadata 确定当前 Agent。

原因：这是 LangGraph 官方推荐的流式输出方式，无需侵入节点代码，能准确获知每个 token 来自哪个节点。

影响：需要 `langgraph >= 0.1.19`。

验证方式：运行前端，提交任务，观察 Researcher 卡片是否逐 token 更新。

---

## 2026-06-04 - AutoGen 使用 monkey-patch generate_reply 捕获消息

决策：在 AutoGen 引擎中临时 monkey-patch `ConversableAgent.generate_reply`，在原方法执行后捕获返回值并放入 asyncio.Queue，完成后恢复原方法。

原因：pyautogen 0.2.x 没有内置的异步 token 流回调；GroupChat 的消息捕获最干净的方式是在 generate_reply 出口处 hook。

影响：线程安全需通过 `asyncio.run_coroutine_threadsafe` 保证；升级到 pyautogen 0.4+ 需改用新 API。

验证方式：切换到 AutoGen 引擎，提交任务，观察三个 Agent 是否依次出现并逐词更新。

---

## 2026-06-04 - 前端 UI 使用 Streamlit + 自定义 CSS

决策：使用 Streamlit 作为前端框架，通过 `st.markdown(unsafe_allow_html=True)` 注入自定义 CSS，实现 Apple/Claude 风格的圆角卡片 UI。

原因：USER_BRIEF 明确要求 Streamlit；自定义 CSS 能在 Streamlit 限制内达到较好的视觉效果。

影响：部分 Streamlit 组件样式通过 CSS 选择器覆盖，可能在 Streamlit 版本升级后失效。

验证方式：启动前端，检查卡片圆角、Agent 颜色区分、输入框样式是否符合设计。

---

## 2026-06-04 - 会话历史仅保存在内存

决策：`thread_histories` 使用 Python 字典存储在后端内存中，不持久化。

原因：USER_BRIEF 未要求持久化；引入数据库会增加不必要的复杂度。

影响：后端重启后历史丢失。

验证方式：接受，符合当前范围。
