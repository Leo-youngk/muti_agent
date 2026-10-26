import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI from 'openai'
import { buildAdvisorSystemPrompt, PROMPT_VERSION } from '../lib/advisorPrompt.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : fallback }
const allCases = (await fs.readFile(path.join(here, 'cases.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
const cases = allCases.filter(item => !option('case') || item.id === option('case')).slice(0, Number(option('limit', allCases.length)))
const advisors = option('advisors', 'jobs').split(',')
if (!cases.length) throw new Error('没有匹配的评测题目')
const apiKey = process.env.QUALITY_EVAL_API_KEY || process.env.OPENAI_API_KEY
const baseURL = process.env.QUALITY_EVAL_BASE_URL || process.env.OPENAI_BASE_URL
const model = option('model', process.env.QUALITY_EVAL_MODEL)
const baseline = await fs.readFile(path.join(here, 'baseline-prompt.txt'), 'utf8')
const source = await fs.readFile(path.join(here, '../lib/advisors.ts'), 'utf8')
const getProfile = async id => {
  const variable = ({ jobs: 'JOBS', musk: 'MUSK', buffett: 'BUFFETT', munger: 'MUNGER' })[id]
  const raw = variable ? source : await fs.readFile(path.join(here, `../lib/profiles/${id}.ts`), 'utf8')
  const pattern = variable ? new RegExp(`const ${variable}_PROFILE = \x60([\\s\\S]*?)\x60\\.trim\\(\\)`) : /export const \w+_PROFILE = `([\s\S]*?)`/
  const found = raw.match(pattern)
  if (!found) throw new Error(`无法读取档案：${id}`)
  return found[1].trim()
}
const profiles = new Map(await Promise.all(advisors.map(async id => [id, await getProfile(id)])))
if (args.includes('--dry-run')) {
  console.log(JSON.stringify({ mode: 'dry-run', cases: cases.length, advisors, profilesValidated: profiles.size, plannedRequests: cases.length * advisors.length * 2, ids: cases.map(c => c.id), promptVersion: PROMPT_VERSION }, null, 2))
  process.exit(0)
}
if (!apiKey || !model) {
  console.error('未执行模型调用：请通过环境变量配置已有模型凭据，并用 --model 指定服务商实际支持的模型。')
  process.exit(2)
}
const client = new OpenAI({ apiKey, baseURL, maxRetries: 0 })
const answers = []
console.log(`运行 ${cases.length} 题 × ${advisors.length} 位顾问 × 两个版本；仅输出安全元数据。`)
for (const item of cases) for (const advisor of advisors) {
  const profile = profiles.get(advisor)
  for (const variant of ['baseline', 'v2']) {
    const started = Date.now()
    let text = '', firstTokenMs = null, finishReason = '', error = null
    const degraded = []
    const options = { temperature: 0.7, response_format: { type: 'json_object' }, thinking: { type: 'disabled' } }
    try {
      let stream
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          stream = await client.chat.completions.create({ model, stream: true, max_tokens: 16384, ...options, messages: [{ role: 'system', content: variant === 'baseline' ? baseline.replace('${profile}', () => profile) : buildAdvisorSystemPrompt(profile) }, ...(item.history ?? []).map(content => ({ role: 'user', content })), { role: 'user', content: item.task }] }, { signal: AbortSignal.timeout(120_000) })
          break
        } catch (failure) {
          const unsupported = Object.keys(options).find(key => new RegExp(key === 'response_format' ? 'response_format|json_object|json mode' : key, 'i').test(failure.message))
          if (!unsupported) throw failure
          delete options[unsupported]
          degraded.push(unsupported)
        }
      }
      if (!stream) throw new Error('参数兼容重试已用完')
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content
        if (token) { firstTokenMs ??= Date.now() - started; text += token }
        finishReason = chunk.choices[0]?.finish_reason || finishReason
      }
    } catch (failure) { error = `模型调用失败${failure.status ? `（HTTP ${failure.status}）` : '（网络、超时或参数不兼容）'}` }
    let parsed = null
    try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) } catch { /* 格式失败需要记录，不能掩盖 */ }
    const valid = Boolean(!error && parsed && typeof parsed.advisor === 'string' && parsed.advisor.trim() && ['支持', '反对', '有条件支持', '需要更多信息'].includes(parsed.stance) && typeof parsed.core_judgment === 'string' && parsed.core_judgment.trim() && typeof parsed.reasoning === 'string' && parsed.reasoning.trim() && !['length', 'content_filter'].includes(finishReason))
    answers.push({ id: item.id, advisor, variant, model, checks: item.checks, task: item.task, text, valid, error, firstTokenMs, elapsedMs: Date.now() - started, finishReason, degraded })
    console.log(`${item.id}/${advisor}/${variant}: ${error ? 'error' : valid ? 'complete' : 'invalid-or-partial'} ${Date.now() - started}ms`)
  }
}
const destination = path.resolve(here, '../../output/quality-evals', new Date().toISOString().replace(/[:.]/g, '-'))
await fs.mkdir(destination, { recursive: true })
const review = ['# 人工盲评', '', '按每题检查点比较 A/B，记录偏好及依据。评分：贴题、事实、具体、互补、人物感、可读性（各 1–5）。', '']
for (let i = 0; i < answers.length; i += 2) {
  const pair = Math.random() < 0.5 ? [answers[i], answers[i + 1]] : [answers[i + 1], answers[i]]
  review.push(`## ${pair[0].id} / ${pair[0].advisor}`, pair[0].task, `检查点：${pair[0].checks.join('；')}`)
  pair.forEach((answer, index) => { answer.blindLabel = index === 0 ? 'A' : 'B'; review.push(`### ${answer.blindLabel}`, answer.text || answer.error || '无内容', '') })
  review.push('偏好：___；原因：___', '')
}
await fs.writeFile(path.join(destination, 'review.md'), review.join('\n'))
await fs.writeFile(path.join(destination, 'answers.json'), JSON.stringify({ promptVersion: PROMPT_VERSION, model, baseHost: baseURL ? new URL(baseURL).hostname : 'api.openai.com', answers }, null, 2))
console.log(`已保存实际调用结果与盲评表：${destination}`)
