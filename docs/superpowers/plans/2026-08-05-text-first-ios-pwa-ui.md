# Text-First iOS PWA UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the card-heavy multi-Agent chat UI with a text-first, single-column iOS PWA reading flow that supports any number of Agents in a stable configured order.

**Architecture:** Keep the existing thread, streaming, persistence, and API orchestration intact. Introduce pure presentation helpers, replace `AdvisorCard` with a document-style response section, make `ChatView` render ordered article sections, and convert `InputBar` into an on-demand bottom composer controlled by `ChatApp`.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, Tailwind CSS, React Markdown, Vitest, Testing Library, IndexedDB/localStorage.

**Design source:** `docs/superpowers/specs/2026-08-05-text-first-ios-pwa-ui-design.md`

---

## File map

- Create `frontend/lib/discussionPresentation.ts`: pure ordering, numbering, and visible-field helpers.
- Create `frontend/__tests__/discussionPresentation.test.ts`: dynamic Agent and field-visibility tests.
- Create `frontend/components/AgentResponseSection.tsx`: one document-style Agent response section.
- Create `frontend/__tests__/AgentResponseSection.test.tsx`: full-content, streaming, failure, and action tests.
- Modify `frontend/components/ChatView.tsx`: single-column document flow and natural-scroll behavior.
- Create `frontend/__tests__/ChatView.test.tsx`: ordered rendering and arbitrary Agent count tests.
- Modify `frontend/components/InputBar.tsx`: on-demand safe-area composer.
- Create `frontend/__tests__/InputBar.test.tsx`: hidden/open/follow-up behavior tests.
- Modify `frontend/components/ChatApp.tsx`: composer lifecycle and minimal streaming stop action.
- Modify `frontend/app/globals.css`: semantic text-first tokens and iOS reading defaults.
- Modify `frontend/components/Sidebar.tsx`: remove fixed-four/brand-heavy visual treatment while retaining thread management.
- Modify `docs/TASKS.md`, `docs/DECISIONS.md`, and `docs/PROJECT_CONTEXT.md`: record implemented behavior after verification.

Do not change `frontend/lib/useStreaming.ts`, storage formats, API routes, Agent prompts, Provider settings, or the legacy Python backend unless a failing test proves a direct dependency.

---

### Task 1: Add deterministic presentation helpers

**Files:**
- Create: `frontend/lib/discussionPresentation.ts`
- Create: `frontend/__tests__/discussionPresentation.test.ts`

- [ ] **Step 1: Write failing tests for dynamic order, numbering, and complete fields**

```ts
// frontend/__tests__/discussionPresentation.test.ts
import { describe, expect, it } from 'vitest'
import type { AdvisorMeta } from '@/lib/advisors'
import type { AdvisorJudgment, AdvisorStatus } from '@/lib/types'
import {
  formatAgentIndex,
  getOrderedActiveAdvisors,
  getVisibleJudgmentSections,
} from '@/lib/discussionPresentation'

const advisor = (id: string): AdvisorMeta => ({
  id,
  name: `Agent ${id}`,
  nameEn: id,
  color: '#000000',
  icon: id,
  tagline: '',
  profile: '',
})

describe('discussion presentation', () => {
  it('preserves configured order for an arbitrary number of agents', () => {
    const advisors = Array.from({ length: 10 }, (_, i) => advisor(`a${i}`))
    const status: Record<string, AdvisorStatus> = {
      a0: 'done', a1: 'thinking', a2: 'idle', a3: 'error', a9: 'done',
    }

    expect(getOrderedActiveAdvisors(advisors, status).map(a => a.id))
      .toEqual(['a0', 'a1', 'a3', 'a9'])
  })

  it('formats stable document section numbers', () => {
    expect(formatAgentIndex(0)).toBe('01')
    expect(formatAgentIndex(8)).toBe('09')
    expect(formatAgentIndex(9)).toBe('10')
    expect(formatAgentIndex(100)).toBe('101')
  })

  it('returns every non-empty structured field in reading order', () => {
    const judgment: AdvisorJudgment = {
      advisor: 'A', stance: '支持', core_judgment: '核心', reasoning: '推理',
      criticism: '批评', focus: '焦点', demand: '改变', approach: '切入', blind_spot: '盲点',
    }

    expect(getVisibleJudgmentSections(judgment).map(s => s.label)).toEqual([
      '核心判断', '推理', '核心批评', '关注焦点', '要求改变', '如何切入', '盲点',
    ])
  })

  it('omits headings whose values are empty', () => {
    expect(getVisibleJudgmentSections({ core_judgment: '核心', reasoning: '' }))
      .toEqual([{ key: 'core_judgment', label: '核心判断', value: '核心', prominent: true }])
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd frontend; npx vitest run __tests__/discussionPresentation.test.ts`

Expected: FAIL because `@/lib/discussionPresentation` does not exist.

- [ ] **Step 3: Implement the pure helpers**

```ts
// frontend/lib/discussionPresentation.ts
import type { AdvisorMeta } from './advisors'
import type { AdvisorJudgment, AdvisorStatus } from './types'

type JudgmentKey = keyof Pick<AdvisorJudgment,
  'core_judgment' | 'reasoning' | 'criticism' | 'focus' |
  'demand' | 'approach' | 'blind_spot'
>

const FIELDS: Array<{ key: JudgmentKey; label: string; prominent?: boolean }> = [
  { key: 'core_judgment', label: '核心判断', prominent: true },
  { key: 'reasoning', label: '推理' },
  { key: 'criticism', label: '核心批评' },
  { key: 'focus', label: '关注焦点' },
  { key: 'demand', label: '要求改变' },
  { key: 'approach', label: '如何切入' },
  { key: 'blind_spot', label: '盲点' },
]

export function formatAgentIndex(index: number): string {
  return String(index + 1).padStart(2, '0')
}

export function getOrderedActiveAdvisors(
  advisors: AdvisorMeta[],
  status: Record<string, AdvisorStatus>,
): AdvisorMeta[] {
  return advisors.filter(({ id }) => status[id] !== undefined && status[id] !== 'idle')
}

export function getVisibleJudgmentSections(data?: Partial<AdvisorJudgment>) {
  if (!data) return []
  return FIELDS.flatMap(field => {
    const value = data[field.key]?.trim()
    return value ? [{ ...field, value, prominent: field.prominent === true }] : []
  })
}
```

- [ ] **Step 4: Re-run the focused test**

Run: `cd frontend; npx vitest run __tests__/discussionPresentation.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit Task 1**

```powershell
git add frontend/lib/discussionPresentation.ts frontend/__tests__/discussionPresentation.test.ts
git commit -m "test: define text-first discussion presentation rules"
```

---

### Task 2: Replace the visual Agent card with a document section

**Files:**
- Create: `frontend/components/AgentResponseSection.tsx`
- Create: `frontend/__tests__/AgentResponseSection.test.tsx`
- Delete after import migration in Task 3: `frontend/components/AdvisorCard.tsx`

- [ ] **Step 1: Write failing component tests**

```tsx
// frontend/__tests__/AgentResponseSection.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AgentResponseSection from '@/components/AgentResponseSection'
import type { AdvisorMeta } from '@/lib/advisors'

const meta: AdvisorMeta = {
  id: 'agent-x', name: '分析 Agent', nameEn: 'Agent X', color: '#ff0000',
  icon: 'X', tagline: '', profile: '',
}

const judgment = {
  advisor: '分析 Agent' as const,
  stance: '支持' as const,
  core_judgment: '核心内容', reasoning: '完整推理', criticism: '主要批评',
  focus: '关注焦点', demand: '要求改变', approach: '切入方式', blind_spot: '潜在盲点',
}

describe('AgentResponseSection', () => {
  it('renders every field by default without an expand control or avatar', () => {
    render(<AgentResponseSection index={0} meta={meta} status="done" judgment={judgment} />)
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('分析 Agent')).toBeInTheDocument()
    for (const text of ['核心内容', '完整推理', '主要批评', '关注焦点', '要求改变', '切入方式', '潜在盲点']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(screen.queryByText(/展开完整判断/)).not.toBeInTheDocument()
    expect(screen.queryByText('X')).not.toBeInTheDocument()
  })

  it('uses plain text for thinking and failure states', () => {
    const { rerender } = render(<AgentResponseSection index={1} meta={meta} status="thinking" />)
    expect(screen.getByText('正在思考…')).toBeInTheDocument()
    rerender(<AgentResponseSection index={1} meta={meta} status="error" errorDetail="服务不可用" />)
    expect(screen.getByText(/请求失败：服务不可用/)).toBeInTheDocument()
  })

  it('calls the inline follow-up and retry actions', () => {
    const follow = vi.fn()
    const retry = vi.fn()
    const { rerender } = render(
      <AgentResponseSection index={0} meta={meta} status="done" judgment={judgment} onFollowUp={follow} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '追问此 Agent' }))
    expect(follow).toHaveBeenCalledOnce()
    rerender(<AgentResponseSection index={0} meta={meta} status="error" onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Verify the component test fails**

Run: `cd frontend; npx vitest run __tests__/AgentResponseSection.test.tsx`

Expected: FAIL because `AgentResponseSection` does not exist.

- [ ] **Step 3: Implement the document-style response section**

Implement `frontend/components/AgentResponseSection.tsx` with this public interface and structure:

```tsx
'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AdvisorMeta } from '@/lib/advisors'
import type { AdvisorJudgment, AdvisorStatus } from '@/lib/types'
import { extractStreamingFields } from '@/lib/parseStreaming'
import { formatAgentIndex, getVisibleJudgmentSections } from '@/lib/discussionPresentation'

interface Props {
  index: number
  meta: AdvisorMeta
  status: AdvisorStatus
  judgment?: AdvisorJudgment
  streamingText?: string
  errorDetail?: string
  onFollowUp?: () => void
  onRetry?: () => void
}

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      }}
    >{children}</ReactMarkdown>
  )
}

export default function AgentResponseSection(props: Props) {
  const streamData = useMemo(() => {
    if (props.status !== 'thinking' || !props.streamingText || props.streamingText.length < 20) return null
    return extractStreamingFields(props.streamingText)
  }, [props.status, props.streamingText])
  const data = props.judgment ?? streamData ?? undefined
  const sections = getVisibleJudgmentSections(data)

  return (
    <section className="border-t border-[var(--line)] py-10 first:border-t-0" aria-labelledby={`agent-${props.index}`}>
      <header className="mb-8">
        <div className="flex items-baseline gap-4">
          <span className="text-[15px] tabular-nums text-[var(--text-faint)]">{formatAgentIndex(props.index)}</span>
          <h2 id={`agent-${props.index}`} className="text-[17px] font-semibold text-[var(--text)]">{props.meta.name}</h2>
        </div>
        {data?.stance && <p className="mt-2 text-[13px] text-[var(--text-muted)]">{data.stance}</p>}
        {props.status === 'thinking' && sections.length === 0 && (
          <p className="mt-4 text-[13px] text-[var(--text-muted)]">正在思考…</p>
        )}
      </header>

      {sections.length > 0 && (
        <div className="space-y-7">
          {sections.map(section => (
            <section key={section.key}>
              <h3 className="mb-2 text-xs font-semibold text-[var(--text-muted)]">{section.label}</h3>
              <div className={section.prominent
                ? 'text-xl font-semibold leading-[1.55] text-[var(--text)]'
                : 'text-base leading-7 text-[var(--text)]'}>
                <Markdown>{section.value}</Markdown>
              </div>
            </section>
          ))}
        </div>
      )}

      {props.status === 'error' && !props.judgment && (
        <p className="text-sm leading-6 text-[var(--error)]">
          请求失败{props.errorDetail ? `：${props.errorDetail}` : ''}。
          {props.onRetry && <button onClick={props.onRetry} className="ml-2 min-h-11 underline underline-offset-4">重试</button>}
        </p>
      )}

      {props.onFollowUp && (
        <button onClick={props.onFollowUp}
          className="mt-7 min-h-11 text-sm font-medium text-[var(--action)] underline decoration-transparent underline-offset-4 hover:decoration-current">
          追问此 Agent
        </button>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run component and existing streaming parser tests**

Run: `cd frontend; npx vitest run __tests__/AgentResponseSection.test.tsx __tests__/parseStreaming.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git add frontend/components/AgentResponseSection.tsx frontend/__tests__/AgentResponseSection.test.tsx
git commit -m "feat: render agent answers as document sections"
```

---

### Task 3: Refactor ChatView into an ordered reading document

**Files:**
- Modify: `frontend/components/ChatView.tsx`
- Create: `frontend/__tests__/ChatView.test.tsx`
- Delete: `frontend/components/AdvisorCard.tsx`

- [ ] **Step 1: Write failing integration tests for order and arbitrary Agent count**

```tsx
// frontend/__tests__/ChatView.test.tsx
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ChatView from '@/components/ChatView'
import type { AdvisorMeta } from '@/lib/advisors'
import type { Message } from '@/lib/types'

const advisor = (index: number): AdvisorMeta => ({
  id: `a${index}`,
  name: `Agent ${index}`,
  nameEn: `Agent ${index}`,
  color: '#000000',
  icon: String(index),
  tagline: '',
  profile: '',
})

function messagesFor(advisors: AdvisorMeta[]): Message[] {
  const reversed = [...advisors].reverse()
  return [
    { id: 'user-1', role: 'user', content: '用户问题正文' },
    {
      id: 'panel-1',
      role: 'panel',
      content: '',
      panel: {
        advisorStatus: Object.fromEntries(reversed.map(a => [a.id, 'done'])),
        judgments: Object.fromEntries(reversed.map(a => [a.id, {
          advisor: a.name,
          stance: '支持',
          core_judgment: `${a.name} 核心`,
          reasoning: `${a.name} 推理`,
          criticism: `${a.name} 批评`,
          blind_spot: `${a.name} 盲点`,
        }])),
        streamingTexts: {},
        analysisStatus: 'idle',
        analysisStream: '',
      },
    },
  ]
}

const callbacks = {
  onFollowUp: vi.fn(),
  onRegenerate: vi.fn(),
  onRetryAdvisor: vi.fn(),
  onStartDiscussion: vi.fn(),
  onContinueDiscussion: vi.fn(),
  onDebate: vi.fn(),
}

describe('ChatView', () => {
  it('renders arbitrary agents in configured order, not completion order', () => {
    const advisors = Array.from({ length: 6 }, (_, index) => advisor(index))
    render(<ChatView {...callbacks} advisors={advisors} messages={messagesFor(advisors)} isStreaming={false} />)

    const headings = screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent)
    expect(headings).toEqual(['Agent 0', 'Agent 1', 'Agent 2', 'Agent 3', 'Agent 4', 'Agent 5'])
    expect(screen.getByText('用户问题正文')).toHaveClass('text-[19px]')
    expect(screen.queryByText(/\/6|进度|展开完整判断/)).not.toBeInTheDocument()
  })

  it('does not offer another multi-agent round for one agent', () => {
    const advisors = [advisor(0)]
    render(<ChatView {...callbacks} advisors={advisors} messages={messagesFor(advisors)} isStreaming={false} />)

    expect(screen.getByRole('button', { name: '继续讨论' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发起下一轮讨论' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the integration test and verify it fails**

Run: `cd frontend; npx vitest run __tests__/ChatView.test.tsx`

Expected: FAIL because current `ChatView` reads map insertion order and renders card/progress UI.

- [ ] **Step 3: Replace the ChatView public props**

Use this interface:

```ts
interface Props {
  messages: Message[]
  advisors: AdvisorMeta[]
  onFollowUp: (advisorId: AdvisorId) => void
  onRegenerate: () => void
  onRetryAdvisor: (advisorId: AdvisorId) => void
  onStartDiscussion: () => void
  onContinueDiscussion: () => void
  onDebate: () => void
  isStreaming: boolean
}
```

Remove `onExamplePrompt`, the avatar empty state, progress bars, card spacing, stance pills, and the floating round button. Import `AgentResponseSection` and `getOrderedActiveAdvisors`.

- [ ] **Step 4: Implement document-flow rendering**

For every panel:

```tsx
const ordered = getOrderedActiveAdvisors(advisors, msg.panel.advisorStatus)
const isLastPanel = msg === panelMessages.at(-1)
const allDone = ordered.length > 0 && ordered.every(a => {
  const status = msg.panel!.advisorStatus[a.id]
  return status === 'done' || status === 'error'
})

return (
  <article key={msg.id} className="mt-10">
    {(msg.followUpMeta || msg.isDebateRound) && (
      <p className="mb-6 text-xs text-[var(--text-muted)]">
        {msg.isDebateRound ? `第 ${panelMessages.indexOf(msg) + 1} 轮` : '定向追问'}
      </p>
    )}
    {ordered.map((meta, index) => (
      <AgentResponseSection
        key={meta.id}
        index={index}
        meta={meta}
        status={msg.panel!.advisorStatus[meta.id]}
        judgment={msg.panel!.judgments[meta.id]}
        streamingText={msg.panel!.streamingTexts?.[meta.id]}
        errorDetail={msg.panel!.advisorErrors?.[meta.id]}
        onFollowUp={isLastPanel && !isStreaming && msg.panel!.advisorStatus[meta.id] === 'done'
          ? () => onFollowUp(meta.id) : undefined}
        onRetry={isLastPanel && !isStreaming && msg.panel!.advisorStatus[meta.id] === 'error'
          ? () => onRetryAdvisor(meta.id) : undefined}
      />
    ))}
    {isLastPanel && allDone && !isStreaming && (
      <div className="flex flex-wrap gap-x-6 border-t border-[var(--line)] py-10 text-sm">
        <button onClick={onContinueDiscussion} className="min-h-11 text-[var(--action)]">继续讨论</button>
        <button onClick={onRegenerate} className="min-h-11 text-[var(--text-muted)]">重新生成本轮</button>
        {ordered.length > 1 && !msg.followUpMeta && !msg.isDebateRound && (
          <button onClick={onDebate} className="min-h-11 text-[var(--action)]">发起下一轮讨论</button>
        )}
      </div>
    )}
  </article>
)
```

Render user messages as plain `text-[19px] leading-[1.65]` paragraphs, not bubbles. Keep a maximum reading width of `680px` with `px-5` and `max-[360px]:px-4`.

- [ ] **Step 5: Implement natural-scroll behavior**

Replace the unconditional new-message scroll with:

```tsx
const [hasNewContent, setHasNewContent] = useState(false)

useEffect(() => {
  if (isNearBottomRef.current) {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setHasNewContent(false)
  } else {
    setHasNewContent(true)
  }
}, [messages])
```

When `hasNewContent` is true, render one low-emphasis text button `查看新内容` above the bottom safe area. Clicking it scrolls to the bottom and clears the flag.

- [ ] **Step 6: Replace the empty state**

```tsx
<div className="mx-auto flex h-full max-w-[680px] flex-col justify-center px-5">
  <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">开始一个讨论</h1>
  <p className="mt-3 max-w-md text-base leading-7 text-[var(--text-muted)]">
    提出一个问题，多个 Agent 会按顺序给出完整判断。
  </p>
  <button onClick={onStartDiscussion}
    className="mt-8 min-h-11 w-fit text-sm font-medium text-[var(--action)] underline underline-offset-4">
    提出问题
  </button>
</div>
```

- [ ] **Step 7: Update the import and remove the old card file**

Delete `frontend/components/AdvisorCard.tsx` only after `ChatView.tsx` no longer imports it. Confirm no remaining imports with:

Run: `cd frontend; Get-ChildItem -Recurse -Include *.ts,*.tsx | Select-String 'AdvisorCard'`

Expected: no matches.

- [ ] **Step 8: Run presentation and ChatView tests**

Run: `cd frontend; npx vitest run __tests__/discussionPresentation.test.ts __tests__/AgentResponseSection.test.tsx __tests__/ChatView.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```powershell
git add frontend/components/ChatView.tsx frontend/components/AgentResponseSection.tsx frontend/components/AdvisorCard.tsx frontend/__tests__/ChatView.test.tsx
git commit -m "feat: turn discussions into ordered reading documents"
```

---

### Task 4: Make the composer on-demand

**Files:**
- Modify: `frontend/components/InputBar.tsx`
- Modify: `frontend/components/ChatApp.tsx`
- Create: `frontend/__tests__/InputBar.test.tsx`

- [ ] **Step 1: Write failing composer lifecycle tests**

```tsx
// frontend/__tests__/InputBar.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InputBar from '@/components/InputBar'
import { AdvisorProvider } from '@/lib/AdvisorContext'

const props = {
  onSubmit: vi.fn(), isStreaming: false, selectedModel: 'model-a',
  onModelChange: vi.fn(), providers: [], onSettingsOpen: vi.fn(), onClose: vi.fn(),
}
const map = { a: { id: 'a', name: 'Agent A', nameEn: 'A', color: '#000', icon: 'A', tagline: '', profile: '' } }

describe('InputBar', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<AdvisorProvider value={map}><InputBar {...props} open={false} /></AdvisorProvider>)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens as a follow-up composer with a cancel action', () => {
    render(<AdvisorProvider value={map}><InputBar {...props} open targetAdvisor="a" /></AdvisorProvider>)
    expect(screen.getByText('追问 Agent A')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭输入' }))
    expect(props.onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd frontend; npx vitest run __tests__/InputBar.test.tsx`

Expected: FAIL because `open`, `onClose`, and `关闭输入` are not implemented.

- [ ] **Step 3: Refactor InputBar into a temporary safe-area composer**

Add props:

```ts
open: boolean
onClose: () => void
```

Return `null` when `open` is false. Replace the current return block with:

```tsx
<div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[var(--page)] px-4 pt-3"
  style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
  <div className="mx-auto max-w-[680px]">
    <div className="mb-2 flex min-h-11 items-center justify-between">
      <span className="text-sm text-[var(--text-muted)]">
        {targetMeta ? `追问 ${targetMeta.name}` : '继续讨论'}
      </span>
      <button onClick={onClose} aria-label="关闭输入" className="min-h-11 min-w-11 text-[var(--text-muted)]">关闭</button>
    </div>
    <div className="border border-[var(--line)] bg-[var(--page)]">
      <div className="flex items-end gap-3 px-3 py-3">
        <textarea
          ref={ref}
          autoFocus
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder={isStreaming ? 'Agent 正在回答…' : targetMeta ? `追问 ${targetMeta.name}…` : '输入问题…'}
          rows={1}
          className="min-h-11 flex-1 resize-none bg-transparent py-2 text-base leading-7 text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
          style={{ maxHeight: '160px' }}
        />
        {(isStreaming || value.trim()) && (
          <button
            onClick={isStreaming ? onStop : submit}
            aria-label={isStreaming ? '停止生成' : '发送'}
            className="min-h-11 min-w-11 text-sm font-medium text-[var(--action)]"
          >
            {isStreaming ? '停止' : '发送'}
          </button>
        )}
      </div>
      <div className="flex min-h-11 items-center gap-2 border-t border-[var(--line)] px-3">
        <ModelSelector
          value={selectedModel}
          onChange={onModelChange}
          disabled={isStreaming}
          providers={providers}
        />
        <div className="flex-1" />
        <button
          onClick={onSettingsOpen}
          className="min-h-11 min-w-11 text-sm text-[var(--text-muted)]"
        >
          设置
        </button>
      </div>
    </div>
  </div>
</div>
```

Remove Agent colors, icon chips, rounded outer card shadows, and colored send states. Keep the existing autosizing, Enter-to-submit, model selector, settings entry, and stop behavior. Add `autoFocus` to the textarea.

- [ ] **Step 4: Add composer state to ChatApp**

```tsx
const [composerOpen, setComposerOpen] = useState(false)

useEffect(() => {
  setComposerOpen((activeThread?.messages.length ?? 0) === 0)
  setTargetAdvisor(null)
}, [activeId, activeThread?.messages.length, setTargetAdvisor])

const openFollowUp = useCallback((advisorId: AdvisorId) => {
  handleFollowUp(advisorId)
  setComposerOpen(true)
}, [handleFollowUp])

const openGeneralComposer = useCallback(() => {
  setTargetAdvisor(null)
  setComposerOpen(true)
}, [setTargetAdvisor])
```

After a successful non-empty submit, call `setComposerOpen(false)`. Pass `activeAdvisors` to `ChatView`, route `onFollowUp` to `openFollowUp`, and route `onStartDiscussion` plus `onContinueDiscussion` to `openGeneralComposer`.

Pass `open={composerOpen}` and `onClose={() => { setComposerOpen(false); setTargetAdvisor(null) }}` to `InputBar`.

- [ ] **Step 5: Keep stop generation reachable without a persistent composer**

In the `ChatApp` header actions, render a text button while streaming:

```tsx
{isStreaming && (
  <button onClick={handleStop} className="min-h-11 px-2 text-sm text-[var(--error)]">
    停止
  </button>
)}
```

Do not add progress animation or a status badge.

- [ ] **Step 6: Run focused tests**

Run: `cd frontend; npx vitest run __tests__/InputBar.test.tsx __tests__/ChatView.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```powershell
git add frontend/components/InputBar.tsx frontend/components/ChatApp.tsx frontend/__tests__/InputBar.test.tsx
git commit -m "feat: open the discussion composer only on demand"
```

---

### Task 5: Apply the text-first visual tokens and iOS reading behavior

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/components/ChatApp.tsx`
- Modify: `frontend/components/Sidebar.tsx`

- [ ] **Step 1: Add semantic tokens and reading defaults**

Append to `frontend/app/globals.css`:

```css
:root {
  --page: #fafaf8;
  --text: #191b1a;
  --text-muted: #6e7471;
  --text-faint: #909693;
  --line: #e5e7e5;
  --action: #0f5a54;
  --error: #a63e35;
}

body {
  background: var(--page);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  text-rendering: optimizeLegibility;
}

::selection {
  background: #dce8e4;
  color: var(--text);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Do not apply `.no-callout` or `user-select: none` to the reading column. Users must be able to select and copy answers.

- [ ] **Step 2: Replace core-shell hard-coded colors**

In `ChatApp.tsx`, change the app, header, inline error, and overlay surfaces to use the semantic CSS variables. Keep the header visually quiet, preserve safe-area logic, and retain 44px hit targets.

In `Sidebar.tsx`, keep the mobile drawer and thread actions but remove advisor identity decorations from the navigation chrome. Use only `--page`, `--text`, `--text-muted`, `--line`, and `--action` for shell state.

- [ ] **Step 3: Run the full automated suite**

Run: `cd frontend; npm test`

Expected: all Vitest files pass.

- [ ] **Step 4: Run the production build**

Run: `cd frontend; npm run build`

Expected: Next.js production build completes with no TypeScript or compilation errors.

- [ ] **Step 5: Check lint availability without hiding failure**

Run: `cd frontend; npm run lint`

Expected: if Next.js reports that `next lint` is unavailable, record it in the task report and do not claim lint passed. Do not add a new lint dependency as part of this UI task.

- [ ] **Step 6: Commit Task 5**

```powershell
git add frontend/app/globals.css frontend/components/ChatApp.tsx frontend/components/Sidebar.tsx
git commit -m "style: apply text-first iOS reading tokens"
```

---

### Task 6: Verify the complete iOS PWA flow and update project records

**Files:**
- Modify: `docs/TASKS.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/PROJECT_CONTEXT.md`

- [ ] **Step 1: Start the application for mobile browser QA**

Run: `cd frontend; npm run dev`

Expected: Next.js starts successfully and prints the local URL.

- [ ] **Step 2: Verify four iPhone viewport sizes**

Invoke the `playwright` skill against the printed local URL and inspect these viewports:

- 320×568
- 375×812
- 390×844
- 430×932

For each viewport, verify no horizontal scroll, no clipped text, body text at least 16px, correct top/bottom safe-area spacing, and at least 85% of the non-header viewport devoted to reading content.

- [ ] **Step 3: Verify dynamic Agent counts and fixed ordering**

Use fixtures or temporary local settings with 1, 4, and 10 active Agents. Trigger out-of-order completions or use mocked delays. Confirm:

- headings remain in configured order;
- every response is fully expanded;
- one Agent does not show `发起下一轮讨论`;
- ten Agents remain a plain continuous document;
- a failed Agent remains in its original location and can retry there.

- [ ] **Step 4: Verify the full interaction flow**

Manually run:

1. Create a new thread.
2. Enter a question in the initially open composer.
3. Submit and confirm the composer closes.
4. Read while multiple Agents stream in fixed positions.
5. Scroll upward and confirm new tokens do not pull the viewport down.
6. Tap `查看新内容` and confirm it reaches the latest content.
7. Tap `追问此 Agent`, confirm the targeted composer opens, then submit.
8. Tap `继续讨论`, confirm the untargeted composer opens.
9. Start a new round and switch threads.
10. Select and copy answer text on iOS/PWA.

Confirm the browser console has no new errors.

- [ ] **Step 5: Re-run final automated verification**

Run: `cd frontend; npm test`

Expected: PASS.

Run: `cd frontend; npm run build`

Expected: PASS.

- [ ] **Step 6: Update the project documents**

In `docs/TASKS.md`, add the completed text-first UI task and copy the eight acceptance criteria from the design spec. In `docs/DECISIONS.md`, record these decisions: single-column document flow, complete default expansion, natural scrolling, fixed configured Agent order, dynamic Agent count, and on-demand composer. In `docs/PROJECT_CONTEXT.md`, replace the card-based UI description with the implemented reading-flow description.

Preserve unrelated existing edits in all three files.

- [ ] **Step 7: Commit documentation and QA evidence**

```powershell
git add docs/TASKS.md docs/DECISIONS.md docs/PROJECT_CONTEXT.md
git commit -m "docs: record text-first discussion UI rollout"
```

---

## Final verification gate

- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Lint result is reported accurately.
- [ ] 320×568, 375×812, 390×844, and 430×932 browser checks pass.
- [ ] 1, 4, and 10 Agent fixtures preserve configured order.
- [ ] Full answers are visible without expansion.
- [ ] Reading mode has no persistent composer.
- [ ] The implementation matches `docs/superpowers/specs/2026-08-05-text-first-ios-pwa-ui-design.md`.
- [ ] No unrelated user changes are staged or committed.
