import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { notFound } from '@/lib/api-helpers'
import type {
  AssistantContentBlock,
  AssistantMessageDTO,
  SourceRef,
} from '@/lib/types'

export const dynamic = 'force-dynamic'

function safeParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

function mapMsg(m: {
  id: string
  conversationId: string
  role: string
  contentJson: string
  attachments: string
  sources: string
  createdAt: Date
}): AssistantMessageDTO {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role as AssistantMessageDTO['role'],
    content:
      safeParse<AssistantContentBlock[]>(m.contentJson) ?? [
        { type: 'text', text: '' },
      ],
    attachments: safeParse(m.attachments) ?? [],
    sources: safeParse<SourceRef[]>(m.sources) ?? [],
    createdAt: m.createdAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// HTML escaping + structured-block → HTML rendering
// ---------------------------------------------------------------------------

function esc(s: unknown): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function isNumericLike(v: unknown): boolean {
  if (typeof v === 'number') return true
  if (typeof v === 'string') return /^-?\d+(\.\d+)?$/.test(v.trim())
  return false
}

function renderBlockHtml(block: AssistantContentBlock): string {
  switch (block.type) {
    case 'text':
    case 'summary':
    case 'warning':
    case 'tool_result':
    case 'confirmation': {
      const text = block.text ?? block.title ?? ''
      if (!text) return ''
      const cls =
        block.type === 'warning'
          ? 'block warning'
          : block.type === 'summary'
            ? 'block summary'
            : block.type === 'tool_result'
              ? 'block tool'
              : block.type === 'confirmation'
                ? 'block confirm'
                : 'block text'
      return `<div class="${cls}">${esc(text).replace(/\n/g, '<br/>')}</div>`
    }
    case 'table': {
      if (!block.columns || !block.rows) return ''
      const header = block.columns
        .map((c) => `<th>${esc(c.label)}</th>`)
        .join('')
      const rows = block.rows
        .map(
          (r) =>
            '<tr>' +
            block
              .columns!.map((c) => {
                const v = r[c.key]
                const txt = v === null || v === undefined ? '' : String(v)
                const numCls = isNumericLike(v) ? ' class="num"' : ''
                return `<td${numCls}>${esc(txt)}</td>`
              })
              .join('') +
            '</tr>',
        )
        .join('')
      return `<div class="block table-wrap">${
        block.title ? `<div class="block-title">${esc(block.title)}</div>` : ''
      }<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`
    }
    case 'cards': {
      if (!block.cards) return ''
      const cards = block.cards
        .map((c) => {
          const tone = c.tone ?? 'default'
          return `<div class="card tone-${tone}">${
            c.title ? `<div class="card-title">${esc(c.title)}</div>` : ''
          }${c.value ? `<div class="card-value">${esc(c.value)}</div>` : ''}${
            c.subtitle ? `<div class="card-subtitle">${esc(c.subtitle)}</div>` : ''
          }${c.meta ? `<div class="card-meta">${esc(c.meta)}</div>` : ''}</div>`
        })
        .join('')
      return `<div class="block cards">${
        block.title ? `<div class="block-title">${esc(block.title)}</div>` : ''
      }<div class="card-grid">${cards}</div></div>`
    }
    case 'deadlines': {
      if (!block.deadlines) return ''
      const items = block.deadlines
        .map(
          (d) =>
            `<li><span class="dl-title">${esc(d.title)}</span>${
              d.date ? `<span class="dl-date">${esc(fmtDate(d.date))}</span>` : ''
            }</li>`,
        )
        .join('')
      return `<div class="block deadlines">${
        block.title ? `<div class="block-title">${esc(block.title)}</div>` : ''
      }<ul>${items}</ul></div>`
    }
    case 'action_items': {
      if (!block.actionItems) return ''
      const items = block.actionItems
        .map(
          (a) =>
            `<li><span class="check">☐</span><span class="ai-title">${esc(
              a.title,
            )}</span>${
              a.dueAt ? `<span class="ai-due">${esc(fmtDate(a.dueAt))}</span>` : ''
            }</li>`,
        )
        .join('')
      return `<div class="block action-items">${
        block.title ? `<div class="block-title">${esc(block.title)}</div>` : ''
      }<ul>${items}</ul></div>`
    }
    case 'sources': {
      if (!block.sources || block.sources.length === 0) return ''
      const items = block.sources
        .map(
          (s) =>
            `<li><span class="src-subject">${esc(
              s.subject ?? s.fromEmail,
            )}</span><span class="src-meta">${esc(
              s.fromEmail,
            )}</span>${s.receivedAt ? `<span class="src-date">${esc(fmtDate(s.receivedAt))}</span>` : ''}</li>`,
        )
        .join('')
      return `<div class="block sources">${
        block.title ? `<div class="block-title">${esc(block.title)}</div>` : ''
      }<ul>${items}</ul></div>`
    }
    case 'chart': {
      if (!block.data || block.data.length === 0) return ''
      const max = Math.max(...block.data.map((d) => d.count), 1)
      const bars = block.data
        .map(
          (d) =>
            `<div class="bar"><span class="bar-count">${d.count}</span><div class="bar-fill" style="height:${
              (d.count / max) * 100
            }%"></div><span class="bar-date">${esc(d.date)}</span></div>`,
        )
        .join('')
      return `<div class="block chart">${
        block.title ? `<div class="block-title">${esc(block.title)}</div>` : ''
      }<div class="chart-grid">${bars}</div></div>`
    }
    default:
      return ''
  }
}

function renderMessageHtml(m: AssistantMessageDTO): string {
  if (m.role === 'user') {
    const text =
      m.content.map((b) => b.text).filter(Boolean).join('\n') || '(empty)'
    return `<div class="msg user"><div class="bubble user-bubble">${esc(text).replace(/\n/g, '<br/>')}</div></div>`
  }
  if (m.role === 'assistant') {
    const blocks = m.content.map(renderBlockHtml).filter(Boolean).join('')
    const sources =
      m.sources && m.sources.length > 0
        ? '<div class="msg-sources"><strong>Sources:</strong> ' +
          m.sources
            .map((s) => esc(s.subject ?? s.fromEmail))
            .join(' · ') +
          '</div>'
        : ''
    return `<div class="msg assistant"><div class="avatar">AI</div><div class="bubble ai-bubble">${
      blocks || '<p class="empty">(no content)</p>'
    }${sources}</div></div>`
  }
  // system / tool
  const text = m.content.map((b) => b.text).filter(Boolean).join('\n')
  if (!text) return ''
  return `<div class="msg system"><div class="bubble sys-bubble">${esc(text).replace(/\n/g, '<br/>')}</div></div>`
}

// ---------------------------------------------------------------------------
// Route handler — returns text/html
// ---------------------------------------------------------------------------

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const conv = await db.assistantConversation.findFirst({
    where: { id, userId: session.userId },
  })
  if (!conv) throw notFound('Conversation not found')

  const rows = await db.assistantMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  })
  const messages = rows.map(mapMsg)

  const title = conv.title || 'Assistant conversation'
  const now = new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const messagesHtml = messages.map(renderMessageHtml).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} — Assistant Export</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1a1a1a;
    background: #fff;
    line-height: 1.5;
    font-size: 14px;
    padding: 32px 24px 64px;
  }
  .doc { max-width: 820px; margin: 0 auto; }
  .doc-header {
    border-bottom: 2px solid #111;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .doc-header h1 { font-size: 22px; margin: 0 0 4px; font-weight: 600; }
  .doc-header .meta { color: #555; font-size: 12px; }
  .doc-header .meta span { margin-right: 12px; }
  .doc-header .badge {
    display: inline-block;
    padding: 2px 8px;
    border: 1px solid #888;
    border-radius: 999px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #444;
  }
  .msg { margin-bottom: 18px; }
  .msg.user { text-align: right; }
  .msg.assistant { display: flex; gap: 10px; align-items: flex-start; }
  .msg.system { text-align: center; }
  .avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: #f0f0f0; color: #555;
    font-size: 10px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .bubble { display: inline-block; max-width: 100%; text-align: left; }
  .user-bubble {
    background: #111; color: #fff;
    padding: 8px 12px; border-radius: 12px 12px 4px 12px;
  }
  .ai-bubble {
    background: #fafafa; border: 1px solid #e2e2e2;
    padding: 12px 14px; border-radius: 4px 12px 12px 12px;
    flex: 1; min-width: 0;
  }
  .sys-bubble {
    background: transparent; color: #777;
    font-style: italic; font-size: 12px;
    padding: 4px 12px; border: 1px dashed #ccc; border-radius: 8px;
  }
  .block { margin: 8px 0; }
  .block.text p, .block.text { margin: 4px 0; }
  .block.summary {
    background: #f7f7f7; border: 1px solid #eee;
    padding: 10px 12px; border-radius: 6px;
  }
  .block.warning {
    background: #fff8e6; border-left: 3px solid #d4a017; color: #6b4f00;
    padding: 10px 12px; border-radius: 4px;
  }
  .block.tool, .block.confirm {
    background: #f7f7f7; border: 1px dashed #ccc;
    padding: 10px 12px; border-radius: 6px;
    font-size: 12px; color: #555;
  }
  .block-title {
    font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em;
    color: #666; margin-bottom: 6px;
  }
  .table-wrap { margin: 8px 0; overflow-x: auto; }
  table {
    width: 100%; border-collapse: collapse;
    font-size: 12px;
  }
  thead th {
    background: #f0f0f0; text-align: left;
    padding: 6px 8px; border-bottom: 1px solid #ddd;
    font-weight: 600; font-size: 11px;
  }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  tbody tr:nth-child(odd) { background: #fafafa; }
  td.num { font-variant-numeric: tabular-nums; text-align: right; }
  .card-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 8px; margin: 8px 0;
  }
  .card {
    border: 1px solid #e2e2e2; border-radius: 6px;
    padding: 10px; border-left: 3px solid #ddd;
  }
  .card.tone-success { border-left-color: #2f9e6e; }
  .card.tone-warning { border-left-color: #d4a017; }
  .card.tone-danger { border-left-color: #c2410c; }
  .card-title { font-size: 11px; color: #666; }
  .card-value { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; margin: 2px 0; }
  .card-subtitle { font-size: 11px; color: #777; }
  .card-meta { font-size: 10px; color: #999; margin-top: 4px; }
  .deadlines ul, .action-items ul, .sources ul {
    list-style: none; padding: 0; margin: 4px 0;
  }
  .deadlines li, .action-items li {
    display: flex; justify-content: space-between;
    padding: 4px 0; border-bottom: 1px dashed #eee;
    font-size: 13px;
  }
  .deadlines .dl-date, .action-items .ai-due {
    color: #666; font-size: 12px;
  }
  .action-items .check { color: #888; margin-right: 6px; }
  .sources li {
    padding: 4px 0; border-bottom: 1px dashed #eee;
    font-size: 12px;
  }
  .sources .src-subject { font-weight: 500; }
  .sources .src-meta { color: #777; margin-left: 6px; }
  .sources .src-date { color: #999; float: right; }
  .msg-sources {
    margin-top: 8px; padding-top: 6px;
    border-top: 1px dashed #ddd;
    font-size: 11px; color: #666;
  }
  .chart-grid {
    display: flex; align-items: flex-end; gap: 4px;
    height: 100px; margin: 8px 0;
  }
  .bar {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: flex-end;
    font-size: 10px; color: #666;
  }
  .bar-fill { width: 100%; background: #444; min-height: 2px; }
  .empty { color: #999; font-style: italic; }
  .doc-footer {
    margin-top: 40px; padding-top: 16px;
    border-top: 1px solid #eee;
    font-size: 11px; color: #888;
    text-align: center;
  }
  @media print {
    body { padding: 0; font-size: 11px; }
    .doc-header { page-break-after: avoid; }
    .msg { page-break-inside: avoid; }
    .table-wrap, .card-grid { page-break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
  <div class="doc">
    <header class="doc-header">
      <h1>${esc(title)}</h1>
      <div class="meta">
        <span>Exported: ${esc(now)}</span>
        <span>Messages: ${messages.length}</span>
        <span class="badge">Mode: ${esc(conv.mode)}</span>
      </div>
    </header>
    <main class="doc-body">
${messagesHtml}
    </main>
    <footer class="doc-footer">
      Institutional Email Intelligence — Assistant Conversation Export
    </footer>
  </div>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  })
}
