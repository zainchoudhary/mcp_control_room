import { useState, useMemo, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, User, Bot, Wrench, ChevronDown, ChevronUp, Pencil, X, Send } from 'lucide-react'
import styles from './ChatMessage.module.css'

function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false)
  const code = String(children).replace(/\n$/, '')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{language || 'text'}</span>
        <button className={styles.copyBtn} onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy code'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '16px',
          background: '#1e1e1e',
          borderRadius: '0 0 10px 10px',
          fontSize: '13px',
          lineHeight: 1.6,
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

function prettify(raw) {
  if (typeof raw === 'object') return JSON.stringify(raw, null, 2)
  if (typeof raw !== 'string') return String(raw)
  const cleaned = raw.replace(/^>-\s*/gm, '').trim()
  try { return JSON.stringify(JSON.parse(cleaned), null, 2) } catch {}
  try {
    const fixed = cleaned
      .replace(/'/g, '"')
      .replace(/True/g, 'true')
      .replace(/False/g, 'false')
      .replace(/None/g, 'null')
    return JSON.stringify(JSON.parse(fixed), null, 2)
  } catch {}
  return cleaned
}

function ToolJson({ text, variant }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className={styles.toolBody}>
      <div className={styles.toolBodyBar}>
        <span className={styles.toolBodyLang}>{variant === 'input' ? 'arguments' : 'response'}</span>
        <button className={styles.toolCopyBtn} onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language="json"
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '14px 16px',
          background: '#1a1a1a',
          borderRadius: '0 0 8px 8px',
          fontSize: '12.5px',
          lineHeight: 1.55,
        }}
        wrapLongLines
      >
        {text}
      </SyntaxHighlighter>
    </div>
  )
}

function ToolCall({ tool, input }) {
  const [expanded, setExpanded] = useState(false)
  const inputStr = prettify(input)

  return (
    <div className={styles.toolCall}>
      <button className={styles.toolCallHeader} onClick={() => setExpanded(e => !e)}>
        <Wrench size={14} />
        <span className={styles.toolName}>{tool}</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && <ToolJson text={inputStr} variant="input" />}
    </div>
  )
}

function ToolResult({ tool, content }) {
  const [expanded, setExpanded] = useState(true)
  const contentStr = prettify(content)

  return (
    <div className={styles.toolResult}>
      <button className={styles.toolResultHeader} onClick={() => setExpanded(e => !e)}>
        <Check size={14} />
        <span>{tool} returned</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && <ToolJson text={contentStr} variant="result" />}
    </div>
  )
}

function decodeResult(raw) {
  const b64Match = raw.match(/^@@JSON@@(.+?)@@END@@$/)
  if (b64Match) {
    try { return decodeURIComponent(escape(atob(b64Match[1]))) } catch {}
  }
  return raw
}

function parseContent(content) {
  const parts = []
  const lines = content.split('\n')
  let markdownBuffer = []

  for (const line of lines) {
    const toolUseMatch = line.match(/^Tool: (.+?)\((.+)\)$/)
    const toolResultMatch = line.match(/^Result: (.+?) -> (.+)$/)

    if (toolUseMatch) {
      if (markdownBuffer.length > 0) {
        parts.push({ type: 'markdown', content: markdownBuffer.join('\n') })
        markdownBuffer = []
      }
      let input = {}
      try { input = JSON.parse(toolUseMatch[2]) } catch { input = toolUseMatch[2] }
      parts.push({ type: 'tool_use', tool: toolUseMatch[1], input })
    } else if (toolResultMatch) {
      if (markdownBuffer.length > 0) {
        parts.push({ type: 'markdown', content: markdownBuffer.join('\n') })
        markdownBuffer = []
      }
      const resultContent = decodeResult(toolResultMatch[2])
      parts.push({ type: 'tool_result', tool: toolResultMatch[1], content: resultContent })
    } else {
      markdownBuffer.push(line)
    }
  }

  if (markdownBuffer.length > 0) {
    parts.push({ type: 'markdown', content: markdownBuffer.join('\n') })
  }

  return parts
}

const markdownComponents = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    if (!inline && match) {
      return <CodeBlock language={match[1]}>{children}</CodeBlock>
    }
    if (!inline && String(children).includes('\n')) {
      return <CodeBlock>{children}</CodeBlock>
    }
    return <code className={styles.inlineCode} {...props}>{children}</code>
  },
  p({ children }) {
    return <p className={styles.paragraph}>{children}</p>
  },
  ul({ children }) {
    return <ul className={styles.list}>{children}</ul>
  },
  ol({ children }) {
    return <ol className={styles.list}>{children}</ol>
  },
  li({ children }) {
    return <li className={styles.listItem}>{children}</li>
  },
  blockquote({ children }) {
    return <blockquote className={styles.blockquote}>{children}</blockquote>
  },
  table({ children }) {
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>{children}</table>
      </div>
    )
  },
  th({ children }) {
    return <th className={styles.th}>{children}</th>
  },
  td({ children }) {
    return <td className={styles.td}>{children}</td>
  },
  h1({ children }) { return <h1 className={styles.heading}>{children}</h1> },
  h2({ children }) { return <h2 className={styles.heading}>{children}</h2> },
  h3({ children }) { return <h3 className={styles.heading}>{children}</h3> },
  hr() { return <hr className={styles.hr} /> },
}

export function ChatMessage({ message, isStreaming, onEdit }) {
  const isUser = message.role === 'user'
  const parts = useMemo(() => isUser ? null : parseContent(message.content), [message.content, isUser])
  const [contentCopied, setContentCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const editRef = useRef(null)

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus()
      editRef.current.style.height = 'auto'
      editRef.current.style.height = editRef.current.scrollHeight + 'px'
    }
  }, [editing])

  const handleCopyAll = async () => {
    await navigator.clipboard.writeText(message.content)
    setContentCopied(true)
    setTimeout(() => setContentCopied(false), 2000)
  }

  const startEdit = () => {
    setEditText(message.content)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditText('')
  }

  const submitEdit = () => {
    const trimmed = editText.trim()
    if (!trimmed || trimmed === message.content) {
      cancelEdit()
      return
    }
    setEditing(false)
    setEditText('')
    onEdit?.(message.id, trimmed)
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitEdit()
    }
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div className={`${styles.message} ${isUser ? styles.userMessage : styles.assistantMessage}`}>
      <div className={styles.messageInner}>
        <div className={styles.avatar}>
          {isUser ? <User size={18} /> : <Bot size={18} />}
        </div>

        <div className={styles.messageBody}>
          <div className={styles.roleLine}>
            <span className={styles.roleName}>{isUser ? 'You' : 'ToolChain AI'}</span>
          </div>

          <div className={styles.messageContent}>
            {isUser ? (
              editing ? (
                <div className={styles.editWrap}>
                  <textarea
                    ref={editRef}
                    className={styles.editTextarea}
                    value={editText}
                    onChange={(e) => {
                      setEditText(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = e.target.scrollHeight + 'px'
                    }}
                    onKeyDown={handleEditKeyDown}
                    rows={1}
                  />
                  <div className={styles.editActions}>
                    <button className={styles.editCancelBtn} onClick={cancelEdit}>
                      <X size={14} />
                      <span>Cancel</span>
                    </button>
                    <button className={styles.editSubmitBtn} onClick={submitEdit} disabled={!editText.trim()}>
                      <Send size={14} />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className={styles.paragraph}>{message.content}</p>
              )
            ) : (
              <>
                {parts?.map((part, i) => {
                  if (part.type === 'tool_use') {
                    return <ToolCall key={i} tool={part.tool} input={part.input} />
                  }
                  if (part.type === 'tool_result') {
                    return <ToolResult key={i} tool={part.tool} content={part.content} />
                  }
                  return (
                    <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {part.content}
                    </ReactMarkdown>
                  )
                })}
                {isStreaming && <span className={styles.cursor} />}
              </>
            )}
          </div>

          {isUser && !editing && !isStreaming && (
            <div className={styles.actions}>
              <button className={styles.actionBtn} onClick={handleCopyAll} title="Copy message">
                {contentCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              {onEdit && (
                <button className={styles.actionBtn} onClick={startEdit} title="Edit message">
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}

          {!isUser && !isStreaming && message.content.trim() && (
            <div className={styles.actions}>
              <button className={styles.actionBtn} onClick={handleCopyAll} title="Copy response">
                {contentCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
