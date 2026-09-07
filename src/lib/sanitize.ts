// HTML email sanitizer.
// Email HTML is untrusted, attacker-controlled content (per the security spec).
// We strip scripts, event handlers, dangerous URL schemes, and external resource loads.

const DANGEROUS_SCHEMES = /^(javascript|data|vbscript|file):/i
const SAFE_TAGS = new Set([
  'p', 'br', 'hr', 'div', 'span', 'a', 'img', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em',
  'u', 's', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table',
  'thead', 'tbody', 'tr', 'td', 'th', 'caption', 'col', 'colgroup', 'sub', 'sup', 'small',
  'font', 'center', 'dl', 'dt', 'dd', 'hr',
])
const SAFE_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  '*': new Set(['style', 'class', 'id', 'align', 'color', 'bgcolor', 'width', 'height']),
}

function stripStyle(style: string): string {
  // Remove expressions and url(javascript:...) in inline styles.
  return style
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/url\s*\(\s*['"]?\s*(javascript|data|vbscript):[^)]*\)/gi, 'url()')
    .replace(/position\s*:\s*fixed/gi, 'position:static')
}

export function sanitizeHtml(html: string): string {
  if (!html) return ''
  // Tokenize tags.
  let out = ''
  let i = 0
  while (i < html.length) {
    const open = html.indexOf('<', i)
    if (open === -1) {
      out += html.slice(i)
      break
    }
    out += html.slice(i, open)
    const close = html.indexOf('>', open)
    if (close === -1) {
      // Unmatched tag — drop the rest.
      break
    }
    const tag = html.slice(open, close + 1)
    out += sanitizeTag(tag)
    i = close + 1
  }
  return out
}

function sanitizeTag(tag: string): string {
  const isClosing = tag.startsWith('</')
  const isComment = tag.startsWith('<!--')
  const isDoctype = /^<!/i.test(tag)
  if (isComment) return ''
  if (isDoctype) return ''
  const inner = tag.slice(isClosing ? 2 : 1, -1).trim()
  const spaceIdx = inner.search(/\s/)
  const name = (spaceIdx === -1 ? inner : inner.slice(0, spaceIdx)).toLowerCase()
  if (!name) return ''
  if (!SAFE_TAGS.has(name)) {
    // Drop script/style/iframe/object/embed entirely.
    return ''
  }
  if (isClosing) return `</${name}>`
  // Parse attributes.
  const attrString = spaceIdx === -1 ? '' : inner.slice(spaceIdx + 1)
  const attrs = parseAttrs(attrString)
  const allowed = SAFE_ATTRS[name] ?? SAFE_ATTRS['*']
  const globalAllowed = SAFE_ATTRS['*']
  const cleanAttrs: string[] = []
  for (const [key, value] of attrs) {
    const lk = key.toLowerCase()
    if (lk.startsWith('on')) continue // event handlers
    if (!allowed.has(lk) && !globalAllowed.has(lk)) continue
    let v = value
    if (lk === 'href' || lk === 'src') {
      if (DANGEROUS_SCHEMES.test(v.trim())) continue
    }
    if (lk === 'style') {
      v = stripStyle(v)
    }
    if (lk === 'href') {
      // Force external links to open safely.
      cleanAttrs.push(`href="${escapeAttr(v)}" target="_blank" rel="noopener noreferrer nofollow"`)
      continue
    }
    cleanAttrs.push(`${lk}="${escapeAttr(v)}"`)
  }
  const selfClose = tag.endsWith('/>') ? ' /' : ''
  return `<${name}${cleanAttrs.length ? ' ' + cleanAttrs.join(' ') : ''}${selfClose}>`
}

function parseAttrs(str: string): [string, string][] {
  const attrs: [string, string][] = []
  const re = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(str)) !== null) {
    attrs.push([m[1], m[2] ?? m[3] ?? m[4] ?? ''])
  }
  return attrs
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Extract URLs from plain text for the "extracted links" feature.
export function extractUrls(text: string | null): { url: string; title?: string }[] {
  if (!text) return []
  const urls = new Set<string>()
  const re = /https?:\/\/[^\s<>"']+/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    urls.add(m[0].replace(/[.,;)]+$/, ''))
  }
  return Array.from(urls).slice(0, 20).map((url) => ({ url }))
}

// Strip HTML to plain text for snippet/bodyText.
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function makeSnippet(text: string | null, max = 180): string {
  if (!text) return ''
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}
