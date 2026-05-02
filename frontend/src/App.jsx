import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
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
import { getSavedUser, fetchMe, logout } from './auth.js'
import { Sidebar } from './components/Sidebar.jsx'
import { ChatMessage } from './components/ChatMessage.jsx'
import { ChatInput } from './components/ChatInput.jsx'
import { RegisterModal } from './components/RegisterModal.jsx'
import { AuthPage } from './components/AuthPage.jsx'
import { ToastContainer } from './components/Toast.jsx'
import { useToast } from './hooks/useToast.js'
import { useTheme } from './hooks/useTheme.js'
import { Bot, Server, Plus, LogOut } from 'lucide-react'
import styles from './App.module.css'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [user, setUser] = useState(() => getSavedUser())
  const [authChecked, setAuthChecked] = useState(false)
  const [mcps, setMcps] = useState([])
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [streamingId, setStreamingId] = useState(null)
  const { toasts, toast, dismiss } = useToast()
  const messagesEndRef = useRef(null)
  const chatAreaRef = useRef(null)

  useEffect(() => {
    fetchMe()
      .then((u) => { if (u) setUser(u); else setUser(null) })
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true))
  }, [])

  const handleAuth = (userData) => {
    setUser(userData)
    refreshMCPs()
  }

  const handleLogout = () => {
    logout()
    setUser(null)
    setMcps([])
    setSessions([])
    setSessionId(null)
    setMessages([])
  }

  const connectedCount = useMemo(() => mcps.filter((m) => m.connected).length, [mcps])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const refreshMCPs = async () => {
    try {
      const data = await listMCPs()
      setMcps(data)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  useEffect(() => {
    if (user) refreshMCPs()
  }, [user])

  const ensureSession = async () => {
    if (sessionId) return sessionId
    const data = await createSession()
    const newSession = {
      id: data.session_id,
      title: null,
      created_at: new Date().toISOString(),
    }
    setSessions((prev) => [newSession, ...prev])
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
    setStreamingId(assistantId)

    // Update session title from first message
    if (messages.length === 0) {
      const title = text.length > 40 ? text.slice(0, 40) + '...' : text
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId || !sessionId ? { ...s, title } : s))
      )
    }

    try {
      const sid = await ensureSession()

      // Fix session title mapping after session creation
      if (!sessionId) {
        const title = text.length > 40 ? text.slice(0, 40) + '...' : text
        setSessions((prev) =>
          prev.map((s) => (s.id === sid ? { ...s, title } : s))
        )
      }

      for await (const event of streamChat(sid, text)) {
        if (event.type === 'token') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + (event.content || '') } : m
            )
          )
        }
        if (event.type === 'tool_use') {
          const line = `Tool: ${event.tool}(${JSON.stringify(event.input || {})})\n`
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + line } : m
            )
          )
        }
        if (event.type === 'tool_result') {
          const line = `Result: ${event.tool} -> ${event.content || ''}\n`
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + line } : m
            )
          )
        }
        if (event.type === 'error') {
          toast(event.content || 'Stream error', 'error')
        }
      }
    } catch (err) {
      toast(err.message, 'error')
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: 'Failed to get response. Please try again.' } : m
        )
      )
    } finally {
      setSending(false)
      setStreamingId(null)
    }
  }

  const handleNewChat = () => {
    setSessionId(null)
    setMessages([])
    setStreamingId(null)
    setInput('')
  }

  const handleSelectSession = (id) => {
    if (id === sessionId) return
    setSessionId(id)
    setMessages([])
    setStreamingId(null)
  }

  const handleDeleteSession = (id) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (id === sessionId) {
      handleNewChat()
    }
  }

  const onRegister = async (payload) => {
    await registerMCP(payload)
    await refreshMCPs()
    toast(`"${payload.name}" registered`, 'success')
  }

  const onConnect = async (id) => {
    await connectMCP(id)
    await refreshMCPs()
    toast('Connected', 'success')
  }

  const onDisconnect = async (id) => {
    await disconnectMCP(id)
    await refreshMCPs()
    toast('Disconnected', 'info')
  }

  const onProbe = async (id) => probeMCP(id)

  const onDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return
    await deleteMCP(id)
    await refreshMCPs()
    toast('Deleted', 'info')
  }

  const suggestions = [
    'What tools are available?',
    'Tell me about the connected MCP servers',
    'What can you help me with?',
    'Run a quick test with available tools',
  ]

  if (!authChecked) {
    return null
  }

  if (!user) {
    return (
      <>
        <AuthPage onAuth={handleAuth} />
        <ToastContainer toasts={toasts} dismiss={dismiss} />
      </>
    )
  }

  return (
    <div className={styles.app}>
      <Sidebar
        sessions={sessions}
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onOpenRegister={() => setShowRegister(true)}
        mcpCount={mcps.length}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        onLogout={handleLogout}
      />

      <main className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            {user && (
              <span className={styles.greeting}>
                Hello, <strong>{user.full_name || user.username}</strong>
              </span>
            )}
          </div>
          <button className={styles.registerBtn} onClick={() => setShowRegister(true)}>
            <Server size={15} />
            <span>Register MCP</span>
            <Plus size={14} />
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Sign out">
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </header>

        <div className={`${styles.chatArea} ${messages.length > 0 ? styles.chatAreaScrollable : styles.chatAreaFixed}`} ref={chatAreaRef}>
          {messages.length === 0 ? (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>
                <Bot size={40} />
              </div>
              <h1 className={styles.welcomeTitle}>ToolChain AI</h1>
              <p className={styles.welcomeSubtitle}>
                Connect MCP servers and chat with an AI agent that uses their tools.
              </p>
              <div className={styles.suggestions}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className={styles.suggestionBtn}
                    onClick={() => { setInput(s) }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {connectedCount > 0 && (
                <p className={styles.connectedInfo}>
                  {connectedCount} MCP server{connectedCount !== 1 ? 's' : ''} connected
                </p>
              )}
            </div>
          ) : (
            <div className={styles.messages}>
              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  isStreaming={m.id === streamingId}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={send}
          sending={sending}
          mcps={mcps}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onProbe={onProbe}
          onDelete={onDelete}
          onOpenRegister={() => setShowRegister(true)}
          connectedCount={connectedCount}
        />
      </main>

      {showRegister && (
        <RegisterModal onClose={() => setShowRegister(false)} onRegister={onRegister} />
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
