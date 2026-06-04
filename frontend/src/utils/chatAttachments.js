const MARKER_RE = /^<!--tc-attachments:(.*?)-->\n?/s

export function formatUserMessageForDisplay(text, attachments = []) {
  if (!attachments.length) return text
  const meta = JSON.stringify(
    attachments.map((a) => ({ id: a.id, name: a.name, kind: a.kind || 'text' }))
  )
  return `<!--tc-attachments:${meta}-->\n${text}`
}

export function parseUserMessageContent(content) {
  if (!content || typeof content !== 'string') {
    return { attachments: [], text: content || '' }
  }
  const m = content.match(MARKER_RE)
  if (!m) return { attachments: [], text: content }
  let attachments = []
  try {
    attachments = JSON.parse(m[1])
    if (!Array.isArray(attachments)) attachments = []
  } catch {
    attachments = []
  }
  return { attachments, text: content.slice(m[0].length) }
}
