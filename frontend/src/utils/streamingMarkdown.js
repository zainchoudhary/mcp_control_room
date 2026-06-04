/**
 * Stabilize partial markdown during SSE streaming so ReactMarkdown renders cleanly.
 */
export function stabilizeStreamingMarkdown(text) {
  if (!text) return text

  let out = text

  // Close unterminated fenced code blocks
  const fences = out.match(/```/g)
  if (fences && fences.length % 2 === 1) {
    out += '\n```'
  }

  // If last line looks like an incomplete heading, keep as plain line until complete
  // (remark still renders partial ## as heading — that's desired for live headings)

  return out
}
