# 回答质量评测

24 个固定问题涵盖缺信息、用户约束、跨轮修正、事实与引用、人格风格和可执行性。`baseline-prompt.txt` 保存优化前的真实统一提示词，V2 直接使用生产的 `lib/advisorPrompt.ts`。相同题目使用同一人物档案、模型与采样参数；上下文也保持一致，单独检验提示词变化。连续对话传递本身由集成回归测试验证。

需要 Node.js 22.6+、已经启动的依赖安装，以及一个实际可用的 OpenAI 兼容模型。凭据只从 `QUALITY_EVAL_API_KEY` / `OPENAI_API_KEY` 读取；网关从 `QUALITY_EVAL_BASE_URL` / `OPENAI_BASE_URL` 读取。禁止把密钥放到命令参数、输出或提交里。

在 `frontend/` 执行：

```powershell
npm run eval:quality -- --dry-run
npm run eval:quality -- --model <网关实际支持的模型> --limit 3
npm run eval:quality -- --model <模型> --advisors jobs,musk,buffett,munger
```

默认运行全部 24 题和一位顾问、两个版本，共 48 个模型请求。`--limit` 可先抽小样本，`--case <id>` 指定题目。模型不支持某参数时会明确记录降级；不自动掩盖错误或为失败结果打成功分。

结果输出至被 Git 忽略的 `output/quality-evals/`：`answers.json` 保存原文、参数、首字耗时、总耗时、结束原因与格式有效性；`review.md` 随机隐藏版本标签供成对人工评分。根据每题 `checks` 评贴题、事实、具体、互补、人物感、可读性，并选 A / B / 持平及原因。

程序检查格式、失败率和时延；内容好坏需要人工审阅。随机交换输出位置，避免总偏好第一个或更长的回答。先固定模型比较提示词，再固定提示词比较模型。没有真实执行时，不宣称 V2 的内容质量已优于基线。
