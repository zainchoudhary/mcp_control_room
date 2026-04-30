import { useEffect, useMemo, useState } from 'react'
import {
  createSession,
  listMCPs,
  registerMCP,
  deleteMCP,
  connectMCP,
  disconnectMCP,
  probeMCP,
  streamChat,
} from './api.js'
import { Sidebar } from './components/Sidebar.jsx'
import { RegisterModal } from './components/RegisterModal.jsx'
import { ToastContainer } from './components/Toast.jsx'
import { useToast } from './hooks/useToast.js'
import styles from './App.module.css'

export default function App() {
  const [mcps, setMcps] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  const connectedCount = useMemo(() => mcps.filter((m) => m.connected).length, [mcps])

  const refreshMCPs = async () => {
    const data = await listMCPs()
    setMcps(data)
  }

  useEffect(() => {
    refreshMCPs().catch((err) => toast(err.message, 'error'))
  }, [])

  const ensureSession = async () => {
    if (sessionId) return sessionId
    const data = await createSession()
    setSessionId(data.session_id)
    return data.session_id
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setSending(true)

    const userMsg = { id: crypto.randomUUID(), role: 'user', content: text }
    const assistantId = crypto.randomUUID()
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const sid = await ensureSession()
      for await (const event of streamChat(sid, text)) {
        if (event.type === 'token') {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + (event.content || '') } : m))
          )
        }
        if (event.type === 'tool_use') {
          const line = `Tool: ${event.tool}(${JSON.stringify(event.input || {})})\n`
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + line } : m))
          )
        }
        if (event.type === 'tool_result') {
          const line = `Result: ${event.tool} -> ${event.content || ''}\n`
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + line } : m))
          )
        }
        if (event.type === 'error') {
          toast(event.content || 'Chat stream error', 'error')
        }
      }
    } catch (err) {
      toast(err.message, 'error')
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: 'Failed to send message.' } : m))
      )
    } finally {
      setSending(false)
    }
  }

  const onRegister = async (payload) => {
    await registerMCP(payload)
    await refreshMCPs()
    toast(`MCP "${payload.name}" registered`, 'success')
  }

  const onConnect = async (id) => {
    await connectMCP(id)
    await refreshMCPs()
    toast('MCP connected', 'success')
  }

  const onDisconnect = async (id) => {
    await disconnectMCP(id)
    await refreshMCPs()
    toast('MCP disconnected', 'info')
  }

  const onProbe = async (id) => {
    return probeMCP(id)
  }

  const onDelete = async (id, name) => {
    if (!window.confirm(`Delete MCP "${name}"?`)) return
    await deleteMCP(id)
    await refreshMCPs()
    toast('MCP deleted', 'info')
  }

  return (
    <div className={styles.app}>
      <Sidebar
        mcps={mcps}
        onAdd={() => setShowRegister(true)}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onProbe={onProbe}
        onDelete={onDelete}
      />

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>MCP Agent Dashboard</h1>
          <div className={styles.meta}>{connectedCount} MCP active</div>
        </header>

        <section className={styles.chatArea}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>Ready to chat</h2>
              <p>Connect MCP servers from the left and start asking questions.</p>
            </div>
          ) : (
            <div className={styles.messages}>
              {messages.map((m) => (
                <article key={m.id} className={`${styles.msg} ${m.role === 'user' ? styles.user : styles.assistant}`}>
                  <div className={styles.role}>{m.role === 'user' ? 'You' : 'Agent'}</div>
                  <pre className={styles.content}>{m.content}</pre>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className={styles.composer}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the agent..."
            className={styles.input}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <button className={styles.send} disabled={sending || !input.trim()} onClick={send}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </footer>
      </main>

      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} onRegister={onRegister} />}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
