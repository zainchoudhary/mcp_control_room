import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  createSession,
  listSessions,
  deleteSessionApi,
  getMessages,
  listMCPs,
  registerMCP,
  deleteMCP,
  connectMCP,
  disconnectMCP,
  probeMCP,
  streamChat,
  getGmailStatus,
} from './api.js'
import { getSavedUser, fetchMe, logout } from './auth.js'
import { Sidebar } from './components/Sidebar.jsx'
import { DashboardPage } from './components/DashboardPage.jsx'
import { MCPServersPage } from './components/MCPServersPage.jsx'
import { ChatMessage } from './components/ChatMessage.jsx'
import { ChatInput } from './components/ChatInput.jsx'
import { RegisterModal } from './components/RegisterModal.jsx'
import { AuthPage } from './components/AuthPage.jsx'
import { LandingPage } from './components/LandingPage.jsx'
import { ToastContainer } from './components/Toast.jsx'
import { ConfirmDialog } from './components/ConfirmDialog.jsx'
import { SettingsModal } from './components/SettingsModal.jsx'
import { useToast } from './hooks/useToast.js'
import { useTheme } from './hooks/useTheme.js'
import { Bot, Menu } from 'lucide-react'
import styles from './App.module.css'

const APP_PAGES = ['dashboard', 'mcp-servers', 'chat']
const AUTH_PAGES = ['login', 'signup', 'forgot-password', 'reset-password']

function getPageFromUrl() {
  const path = window.location.pathname.replace(/^\/+/, '').toLowerCase()
  if (path === '' || path === '/') return 'landing'
  if (APP_PAGES.includes(path)) return path
  return 'dashboard'
}

function getAuthModeFromUrl() {
  const path = window.location.pathname.replace(/^\/+/, '').toLowerCase()
  if (path === 'signup') return 'signup'
  if (path === 'forgot-password') return 'forgot'
  if (path === 'reset-password') return 'reset'
  return 'login'
}

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const savedUser = getSavedUser()
  const [user, setUser] = useState(() => savedUser)
  const [authChecked, setAuthChecked] = useState(!!savedUser)
  const [activePage, setActivePage] = useState(getPageFromUrl)
  const [mcps, setMcps] = useState([])
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [initialSelectedMcp, setInitialSelectedMcp] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [streamingId, setStreamingId] = useState(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [dataLoading, setDataLoading] = useState(!!savedUser)
  const { toasts, toast, dismiss } = useToast()
  const messagesEndRef = useRef(null)
  const chatAreaRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then(async (u) => {
        if (cancelled) return
        if (u) {
          setUser(u)
          setDataLoading(true)
          await Promise.all([refreshMCPs(), refreshSessions()])
          if (!cancelled) setDataLoading(false)
        } else {
          setUser(null)
          setDataLoading(false)
        }
      })
      .catch(() => { if (!cancelled) { setUser(null); setDataLoading(false) } })
      .finally(() => { if (!cancelled) setAuthChecked(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!authChecked) return
    const path = window.location.pathname.replace(/^\/+/, '').toLowerCase()
    if (user) {
      if (AUTH_PAGES.includes(path)) {
        setActivePage('dashboard')
        window.history.replaceState(null, '', '/dashboard')
      } else if (path === '' || path === '/') {
        setActivePage('landing')
      }
    } else {
      if (!AUTH_PAGES.includes(path) && path !== '') {
        window.history.replaceState(null, '', '/')
      }
    }
  }, [authChecked, user])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail_linked') === 'true') {
      const email = params.get('email') || 'your Gmail'
      toast(`Gmail connected: ${email}`, 'success')
      refreshMCPs()
      window.history.replaceState(null, '', window.location.pathname)
    } else if (params.get('gmail_error')) {
      toast(`Gmail auth failed: ${params.get('gmail_error')}`, 'error')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [user, theme])

  const handleAuth = async (userData) => {
    setUser(userData)
    setDataLoading(true)
    const savedPage = getPageFromUrl()
    setActivePage(savedPage)
    if (!APP_PAGES.includes(window.location.pathname.replace(/^\/+/, ''))) {
      window.history.replaceState(null, '', '/dashboard')
    }
    await Promise.all([refreshMCPs(), refreshSessions()])
    setDataLoading(false)
  }

  const [logoutLoading, setLogoutLoading] = useState(false)

  const requestLogout = () => {
    setConfirmDialog({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out? You will need to log in again.',
      confirmLabel: 'Sign Out',
      icon: 'logout',
      variant: 'danger',
      onConfirm: () => {
        setLogoutLoading(true)
        setTimeout(() => {
          setLogoutLoading(false)
          setConfirmDialog(null)
          logout()
          setUser(null)
          setMcps([])
          setSessions([])
          setSessionId(null)
          setMessages([])
          setActivePage('login')
          window.history.replaceState(null, '', '/login')
        }, 1000)
      },
    })
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

  const refreshSessions = async () => {
    try {
      const data = await listSessions()
      setSessions(data)
    } catch (err) {
      toast(err.message, 'error')
    }
  }


  const ensureSession = async () => {
    if (sessionId) return sessionId
    const data = await createSession()
    setSessions((prev) => [data, ...prev])
    setSessionId(data.id)
    return data.id
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

    try {
      const sid = await ensureSession()

      if (messages.length === 0) {
        const title = text.length > 80 ? text.slice(0, 80) + '...' : text
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
    setActivePage('chat')
    window.history.pushState(null, '', '/chat')
  }

  const handleSelectSession = async (id) => {
    if (id === sessionId && activePage === 'chat') return
    setSessionId(id)
    setMessages([])
    setStreamingId(null)
    setLoadingMessages(true)
    setActivePage('chat')
    window.history.pushState(null, '', '/chat')
    try {
      const msgs = await getMessages(id)
      setMessages(msgs.map((m) => ({ id: crypto.randomUUID(), ...m })))
    } catch {
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleDeleteSession = (id) => {
    const session = sessions.find((s) => s.id === id)
    setConfirmDialog({
      title: 'Delete Conversation',
      message: `Delete "${session?.title || 'this conversation'}"? All messages will be lost.`,
      confirmLabel: 'Delete',
      icon: 'delete',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null)
        try {
          await deleteSessionApi(id)
        } catch { /* ignore */ }
        setSessions((prev) => prev.filter((s) => s.id !== id))
        if (id === sessionId) {
          handleNewChat()
        }
      },
    })
  }

  const onRegister = async (payload) => {
    await registerMCP(payload)
    await refreshMCPs()
    toast(`"${payload.name}" registered`, 'success')
  }

  const [togglingMcp, setTogglingMcp] = useState(null)

  const onConnect = async (id) => {
    setTogglingMcp(id)
    try {
      const result = await connectMCP(id)
      if (result && result.needs_auth && result.auth_url) {
        window.open(result.auth_url, '_blank', 'width=600,height=700,scrollbars=yes')
        toast('Please complete Gmail authentication in the opened window', 'info')
        setTogglingMcp(null)
        return
      }
      await refreshMCPs()
      toast('Connected', 'success')
    } finally { setTogglingMcp(null) }
  }

  const onDisconnect = async (id) => {
    setTogglingMcp(id)
    try {
      await disconnectMCP(id)
      await refreshMCPs()
      toast('Disconnected', 'info')
    } finally { setTogglingMcp(null) }
  }

  const onProbe = async (id) => probeMCP(id)

  const [deleteLoading, setDeleteLoading] = useState(false)

  const onDelete = (id, name) => {
    setConfirmDialog({
      title: 'Delete Server',
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      icon: 'delete',
      variant: 'danger',
      onConfirm: async () => {
        setDeleteLoading(true)
        await new Promise((r) => setTimeout(r, 1000))
        setMcps((prev) => prev.filter((m) => m.id !== id))
        setConfirmDialog(null)
        setDeleteLoading(false)
        toast('Deleted', 'info')
        try {
          await deleteMCP(id)
        } catch {
          await refreshMCPs()
        }
      },
    })
  }

  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname.replace(/^\/+/, '').toLowerCase()
      if (path === '' || path === '/') {
        setActivePage('landing')
      } else {
        setActivePage(getPageFromUrl())
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const handleNavigate = (page) => {
    setActivePage(page)
    window.history.pushState(null, '', `/${page}`)
  }

  const suggestions = [
    'What tools are available?',
    'Tell me about the connected MCP servers',
    'What can you help me with?',
    'Run a quick test with available tools',
  ]

  if (!authChecked) {
    const path = window.location.pathname.replace(/^\/+/, '').toLowerCase()

    if (path === '' || path === '/') {
      return (
        <LandingPage
          onGetStarted={() => {
            window.history.pushState(null, '', '/signup')
            setActivePage('signup')
          }}
          onSignIn={() => {
            window.history.pushState(null, '', '/login')
            setActivePage('login')
          }}
        />
      )
    }

    if (AUTH_PAGES.includes(path)) {
      return (
        <>
          <AuthPage onAuth={handleAuth} initialMode={getAuthModeFromUrl()} />
          <ToastContainer toasts={toasts} dismiss={dismiss} />
        </>
      )
    }

    return null
  }

  if (!user) {
    const currentPath = window.location.pathname.replace(/^\/+/, '').toLowerCase()
    const showAuth = AUTH_PAGES.includes(currentPath) || AUTH_PAGES.includes(activePage)

    if (!showAuth) {
      return (
        <LandingPage
          onGetStarted={() => {
            window.history.pushState(null, '', '/signup')
            setActivePage('signup')
          }}
          onSignIn={() => {
            window.history.pushState(null, '', '/login')
            setActivePage('login')
          }}
        />
      )
    }

    return (
      <>
        <AuthPage onAuth={handleAuth} initialMode={getAuthModeFromUrl()} />
        <ToastContainer toasts={toasts} dismiss={dismiss} />
      </>
    )
  }

  if (activePage === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => {
          setActivePage('dashboard')
          window.history.pushState(null, '', '/dashboard')
        }}
        onSignIn={() => {
          setActivePage('dashboard')
          window.history.pushState(null, '', '/dashboard')
        }}
      />
    )
  }

  return (
    <div className={styles.app}>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        sessions={sessions}
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onOpenSettings={() => setShowSettings(true)}
        user={user}
        onLogout={requestLogout}
        mcpCount={mcps.length}
        connectedCount={connectedCount}
      />

      <div className={styles.mobileHeader}>
        <button className={styles.mobileMenuBtn} onClick={() => setSidebarCollapsed(false)}>
          <Menu size={20} />
        </button>
        <div className={styles.mobileHeaderBrand}>
          <div className={styles.mobileHeaderIcon}><Bot size={14} /></div>
          <span>ToolChain AI</span>
        </div>
      </div>

      <main className={styles.main}>
        {activePage === 'dashboard' && (
          <DashboardPage
            mcps={mcps}
            sessions={sessions}
            connectedCount={connectedCount}
            onNavigate={handleNavigate}
            onNewChat={handleNewChat}
            onSelectSession={handleSelectSession}
            onOpenRegister={() => setShowRegister(true)}
            onSelectMcp={(mcp) => { setInitialSelectedMcp(mcp); handleNavigate('mcp-servers') }}
            user={user}
            loading={dataLoading}
          />
        )}

        {activePage === 'mcp-servers' && (
          <MCPServersPage
            mcps={mcps}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onProbe={onProbe}
            onDelete={onDelete}
            onOpenRegister={() => setShowRegister(true)}
            togglingMcp={togglingMcp}
            connectedCount={connectedCount}
            initialSelectedMcp={initialSelectedMcp}
            onClearInitialMcp={() => setInitialSelectedMcp(null)}
          />
        )}

        {activePage === 'chat' && (
          <div className={styles.chatPage}>
            <div className={`${styles.chatArea} ${messages.length > 0 || loadingMessages ? styles.chatAreaScrollable : styles.chatAreaFixed}`} ref={chatAreaRef}>
              {loadingMessages ? (
                <div className={styles.skeletonWrap}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`${styles.skeleton} ${i % 2 === 0 ? styles.skeletonAlt : ''}`}>
                      <div className={styles.skeletonAvatar} />
                      <div className={styles.skeletonLines}>
                        <div className={styles.skeletonLine} style={{ width: i === 1 ? '70%' : i === 2 ? '90%' : '50%' }} />
                        <div className={styles.skeletonLine} style={{ width: i === 1 ? '45%' : i === 2 ? '60%' : '35%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
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
              connectedCount={connectedCount}
              onOpenRegister={() => setShowRegister(true)}
              mcps={mcps}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              togglingMcp={togglingMcp}
            />
          </div>
        )}
      </main>

      {showRegister && (
        <RegisterModal onClose={() => setShowRegister(false)} onRegister={onRegister} />
      )}

      {showSettings && (
        <SettingsModal
          theme={theme}
          onToggleTheme={toggleTheme}
          onClose={() => setShowSettings(false)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          open
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          icon={confirmDialog.icon}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => { if (!logoutLoading && !deleteLoading) setConfirmDialog(null) }}
          loading={logoutLoading || deleteLoading}
        />
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
