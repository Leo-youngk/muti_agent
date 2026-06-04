import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 60

const PROMPTS: Record<string, string> = {
  Researcher:
    'You are the Researcher agent. Carefully analyze the given task, identify key aspects, and propose initial solutions. Be thorough and structured.',
  Critic:
    'You are the Critic agent. Review the Researcher\'s analysis: find weaknesses, risks, gaps, and unstated assumptions. Be constructive but direct.',
  Synthesizer:
    'You are the Synthesizer agent. Integrate the Researcher\'s analysis and the Critic\'s review into a clear, complete, and actionable final response.',
}

const AGENTS = ['Researcher', 'Critic', 'Synthesizer'] as const

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 400 })
  }

  // 支持自定义 base URL（如 opencode.ai、DeepSeek 等兼容 OpenAI 接口的服务商）
  const baseURL = process.env.OPENAI_BASE_URL ?? undefined
  // 支持自定义模型名
  const model = process.env.AI_MODEL ?? 'gpt-4o'

  const body = await request.json().catch(() => ({}))
  const task: string = body.task ?? ''
  if (!task.trim()) {
    return Response.json({ error: 'Task cannot be empty.' }, { status: 422 })
  }

  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        const outputs: Partial<Record<string, string>> = {}

        for (const agent of AGENTS) {
          send({ event: 'agent_start', agent })

          let userContent = `Task: ${task}`
          if (agent === 'Critic') {
            userContent += `\n\nResearcher's analysis:\n${outputs['Researcher'] ?? ''}`
          } else if (agent === 'Synthesizer') {
            userContent += `\n\nResearcher's analysis:\n${outputs['Researcher'] ?? ''}\n\nCritic's review:\n${outputs['Critic'] ?? ''}`
          }

          const completion = await client.chat.completions.create({
            model,
            stream: true,
            temperature: 0.7,
            messages: [
              { role: 'system', content: PROMPTS[agent] },
              { role: 'user', content: userContent },
            ],
          })

          let full = ''
          for await (const chunk of completion) {
            const token = chunk.choices[0]?.delta?.content ?? ''
            if (token) {
              full += token
              send({ event: 'token', agent, content: token })
            }
          }

          outputs[agent] = full
          send({ event: 'agent_complete', agent, content: full })
        }

        send({ event: 'complete' })
      } catch (err: unknown) {
        send({ event: 'error', error: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
