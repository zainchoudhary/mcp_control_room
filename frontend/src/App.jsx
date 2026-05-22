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
  getWeeklyStats,
} from './api.js'
import { getSavedUser, fetchMe, logout } from './auth.js'
import { Sidebar } from './components/Sidebar.jsx'
import { DashboardPage } from './components/DashboardPage.jsx'
import { MCPServersPage } from './components/MCPServersPage.jsx'
import { ToolExecutionPage } from './components/ToolExecutionPage.jsx'
import { ChatMessage } from './components/ChatMessage.jsx'
import { ChatInput } from './components/ChatInput.jsx'
import { RegisterModal } from './components/RegisterModal.jsx'
import { AuthPage } from './components/AuthPage.jsx'
import { LandingPage } from './components/LandingPage.jsx'
import { PricingPage } from './components/PricingPage.jsx'
import { ToastContainer } from './components/Toast.jsx'
import { ConfirmDialog } from './components/ConfirmDialog.jsx'
import { SettingsPage } from './components/SettingsModal.jsx'
import { useToast } from './hooks/useToast.js'
import { useTheme } from './hooks/useTheme.js'
import { useLanguage } from './hooks/useLanguage.js'
import { useAccentColor } from './hooks/useAccentColor.js'
import { Bot, Menu } from 'lucide-react'
import styles from './App.module.css'

const APP_PAGES = ['dashboard', 'mcp-servers', 'tool-execution', 'chat', 'pricing', 'settings']
const AUTH_PAGES = ['login', 'signup', 'forgot-password', 'reset-password']

function getPageFromUrl() {
  const path = window.location.pathname.replace(/^\/+/, '').toLowerCase()
  if (new URLSearchParams(window.location.search).has('reset_token')) {
    window.history.replaceState(null, '', `/reset-password${window.location.search}`)
    return 'reset-password'
  }
  if (path === '' || path === '/') return 'landing'
  if (APP_PAGES.includes(path)) return path
  if (AUTH_PAGES.includes(path)) return path
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
  const savedUser = getSavedUser()
  const [user, setUser] = useState(() => savedUser)
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage(user?.id)
  const { accentId, setAccentColor } = useAccentColor(user?.id)
  const [authChecked, setAuthChecked] = useState(!!savedUser)
  const [activePage, setActivePage] = useState(getPageFromUrl)
  const [mcps, setMcps] = useState([])
  const [mcpsLoading, setMcpsLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
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
  const [dataLoading, setDataLoading] = useState(!!savedUser)
  const [weeklyStats, setWeeklyStats] = useState(null)
  const [toolExecState, setToolExecState] = useState({ mcpId: null, toolName: null, tools: null, formCache: {} })
  const userId = user?.id || 'anon'
  const disabledKeyRef = useRef(`toolchain_disabled_mcps_${userId}`)
  const loadDisabled = (key) => { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) } catch { return new Set() } }
  const saveDisabled = (s) => localStorage.setItem(disabledKeyRef.current, JSON.stringify([...s]))
  const [enabledMcpIds, setEnabledMcpIds] = useState(new Set())
  const manuallyDisabledRef = useRef(loadDisabled(disabledKeyRef.current))
  useEffect(() => {
    disabledKeyRef.current = `toolchain_disabled_mcps_${userId}`
    manuallyDisabledRef.current = loadDisabled(disabledKeyRef.current)
  }, [userId])
  const { toasts, toast, dismiss } = useToast()
  const messagesEndRef = useRef(null)
  const chatAreaRef = useRef(null)
  const pendingPromptRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then(async (u) => {
        if (cancelled) return
        if (u) {
          setUser(u)
          setDataLoading(false)
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
    const hasResetToken = new URLSearchParams(window.location.search).has('reset_token')
    const params = new URLSearchParams(window.location.search)
    if (user) {
      if (params.get('checkout') === 'success') {
        toast('Subscription activated! Welcome to your new plan.', 'success')
        window.history.replaceState(null, '', '/dashboard')
        setActivePage('dashboard')
        fetchMe().then(u => { if (u) { setUser(u); localStorage.setItem('toolchain_user', JSON.stringify(u)) } })
      } else if (AUTH_PAGES.includes(path) && !hasResetToken) {
        setActivePage('dashboard')
        window.history.replaceState(null, '', '/dashboard')
      } else if (path === '' || path === '/') {
        setActivePage('landing')
      }
    } else {
      if (path === 'pricing') {
        setActivePage('pricing')
      } else if (!AUTH_PAGES.includes(path) && path !== '') {
        window.history.replaceState(null, '', '/')
      }
    }
  }, [authChecked, user])

  useEffect(() => {
    if (!user) {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [user, theme])

  const handleAuth = async (userData) => {
    setUser(userData)
    setDataLoading(false)
    const savedPage = getPageFromUrl()
    setActivePage(APP_PAGES.includes(savedPage) ? savedPage : 'dashboard')
    if (!APP_PAGES.includes(window.location.pathname.replace(/^\/+/, ''))) {
      window.history.replaceState(null, '', '/dashboard')
    }
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
          setMcpsLoading(true)
          setSessions([])
          setSessionsLoading(true)
          setSessionId(null)
          setMessages([])
          setActivePage('login')
          window.history.replaceState(null, '', '/login')
        }, 1000)
      },
    })
  }

  const connectedMcps = useMemo(() => mcps.filter((m) => m.connected), [mcps])
  const connectedCount = connectedMcps.length
  const chatEnabledCount = useMemo(
    () => connectedMcps.filter((m) => enabledMcpIds.has(m.id)).length,
    [connectedMcps, enabledMcpIds],
  )

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const refreshMCPs = useCallback(async () => {
    try {
      const data = await listMCPs()
      setMcps(data)
      const connectedIds = new Set(data.filter((m) => m.connected).map((m) => m.id))
      setEnabledMcpIds(() => {
        const disabled = manuallyDisabledRef.current
        const next = new Set()
        connectedIds.forEach((id) => {
          if (!disabled.has(id)) next.add(id)
        })
        return next
      })
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setMcpsLoading(false)
    }
  }, [])

  const refreshSessions = useCallback(async () => {
    try {
      const data = await listSessions()
      setSessions(data)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  const refreshStats = useCallback(async () => {
    try {
      const data = await getWeeklyStats()
      setWeeklyStats(data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (!user || activePage !== 'dashboard') return
    refreshStats()
    refreshMCPs()
    refreshSessions()
  }, [user, activePage])

  useEffect(() => {
    if (!user || activePage !== 'dashboard') return
    const interval = setInterval(refreshStats, 30000)
    return () => clearInterval(interval)
  }, [user, activePage])

  useEffect(() => {
    if (!user || activePage !== 'mcp-servers') return
    refreshMCPs()
  }, [user, activePage])

  useEffect(() => {
    if (!user || activePage !== 'chat') return
    refreshSessions()
    refreshMCPs()
  }, [user, activePage])

  useEffect(() => {
    if (!user || activePage !== 'tool-execution') return
    refreshMCPs()
  }, [user, activePage])


  const ensureSession = async () => {
    if (sessionId) return sessionId
    const data = await createSession()
    setSessions((prev) => [data, ...prev])
    setSessionId(data.id)
    return data.id
  }

  const send = async (overrideText) => {
    const text = (typeof overrideText === 'string' ? overrideText : input).trim()
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

      for await (const event of streamChat(sid, text, [...enabledMcpIds])) {
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
          let displayContent = event.content || ''
          try {
            const parsed = JSON.parse(displayContent)
            displayContent = JSON.stringify(parsed, null, 2)
          } catch {}
          const encoded = btoa(unescape(encodeURIComponent(displayContent)))
          const line = `Result: ${event.tool} -> @@JSON@@${encoded}@@END@@\n`
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + line } : m
            )
          )
        }
        if (event.type === 'error') {
          const msg = event.content || 'Stream error'
          const isRetryable = msg.includes('failed_generation') || msg.includes('tool call validation') || msg.includes('failed to call a function')
          if (!isRetryable) toast(msg, 'error')
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

  const handleEditMessage = async (messageId, newText) => {
    if (sending) return
    const idx = messages.findIndex((m) => m.id === messageId)
    if (idx === -1) return

    const kept = messages.slice(0, idx)
    const editedMsg = { ...messages[idx], content: newText }
    const assistantId = crypto.randomUUID()

    setMessages([...kept, editedMsg, { id: assistantId, role: 'assistant', content: '' }])
    setStreamingId(assistantId)
    setSending(true)
    setInput('')

    try {
      const sid = await ensureSession()
      for await (const event of streamChat(sid, newText, [...enabledMcpIds])) {
        if (event.type === 'token') {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: m.content + (event.content || '') } : m)
          )
        }
        if (event.type === 'tool_use') {
          const line = `Tool: ${event.tool}(${JSON.stringify(event.input || {})})\n`
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: m.content + line } : m)
          )
        }
        if (event.type === 'tool_result') {
          let displayContent = event.content || ''
          try { displayContent = JSON.stringify(JSON.parse(displayContent), null, 2) } catch {}
          const encoded = btoa(unescape(encodeURIComponent(displayContent)))
          const line = `Result: ${event.tool} -> @@JSON@@${encoded}@@END@@\n`
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: m.content + line } : m)
          )
        }
        if (event.type === 'error') {
          const msg = event.content || 'Stream error'
          const isRetryable = msg.includes('failed_generation') || msg.includes('tool call validation') || msg.includes('failed to call a function')
          if (!isRetryable) toast(msg, 'error')
        }
      }
    } catch (err) {
      toast(err.message, 'error')
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: 'Failed to get response. Please try again.' } : m)
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

  useEffect(() => {
    if (activePage === 'chat' && pendingPromptRef.current && !sending) {
      const prompt = pendingPromptRef.current
      pendingPromptRef.current = null
      setInput(prompt)
      const timer = setTimeout(() => send(prompt), 100)
      return () => clearTimeout(timer)
    }
  }, [activePage, messages])

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

  const finishAuthConnect = async (mcpId, label) => {
    try {
      await connectMCP(mcpId, { skipAuth: true })
      await refreshMCPs()
      toast(label ? `Connected: ${label}` : 'Connected', 'success')
    } catch {
      toast('Connection failed after auth', 'error')
    } finally {
      setTogglingMcp(null)
    }
  }

  useEffect(() => {
    const handler = (event) => {
      const t = event.data?.type
      if (t === 'gmail_auth_complete' || t === 'mcp_auth_complete') {
        const label = event.data.email || event.data.username || ''
        if (pendingConnectRef.current) {
          const mcpId = pendingConnectRef.current
          pendingConnectRef.current = null
          finishAuthConnect(mcpId, label)
        }
      }
      if (t === 'gmail_auth_error' || t === 'mcp_auth_error') {
        toast(`Auth failed: ${event.data.error || 'Unknown error'}`, 'error')
        pendingConnectRef.current = null
        setTogglingMcp(null)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const pendingConnectRef = useRef(null)

  const onConnect = async (id) => {
    setTogglingMcp(id)
    try {
      const result = await connectMCP(id)
      if (result?.needs_auth && result?.auth_url) {
        pendingConnectRef.current = id
        const w = 500, h = 600
        const left = window.screenX + (window.outerWidth - w) / 2
        const top = window.screenY + (window.outerHeight - h) / 2
        const popup = window.open(result.auth_url, '_blank', `width=${w},height=${h},left=${left},top=${top}`)
        const pollClose = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(pollClose)
            if (pendingConnectRef.current) {
              const mcpId = pendingConnectRef.current
              pendingConnectRef.current = null
              connectMCP(mcpId)
                .then(async (r) => {
                  if (r?.connected) {
                    await refreshMCPs()
                    toast('Connected', 'success')
                  }
                })
                .catch(() => {})
                .finally(() => setTogglingMcp(null))
            }
          }
        }, 500)
        return
      }
      await refreshMCPs()
      toast('Connected', 'success')
    } catch (err) {
      toast(err.message || 'Connection failed', 'error')
    } finally {
      if (!pendingConnectRef.current) setTogglingMcp(null)
    }
  }

  const onDisconnect = (id) => {
    const mcp = mcps.find((m) => m.id === id)
    const name = mcp?.name || 'this server'
    setConfirmDialog({
      title: 'Disconnect Server',
      message: `Disconnect "${name}"? You will need to re-authenticate to use it again.`,
      confirmLabel: 'Disconnect',
      icon: 'disconnect',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null)
        setTogglingMcp(id)
        try {
          await disconnectMCP(id)
          await refreshMCPs()
          toast('Disconnected', 'info')
        } finally { setTogglingMcp(null) }
      },
    })
  }

  const onChatToggle = (id) => {
    setEnabledMcpIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        manuallyDisabledRef.current.add(id)
      } else {
        next.add(id)
        manuallyDisabledRef.current.delete(id)
      }
      saveDisabled(manuallyDisabledRef.current)
      return next
    })
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
    t('suggestion1'),
    t('suggestion2'),
    t('suggestion3'),
    t('suggestion4'),
  ]

  if (!authChecked) {
    const path = window.location.pathname.replace(/^\/+/, '').toLowerCase()

    if (path === '' || path === '/') {
      return (
        <LandingPage
          isLoggedIn={false}
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

    if (activePage === 'pricing' || currentPath === 'pricing') {
      return (
        <>
          <PricingPage
            user={null}
            t={t}
            onNavigate={(page) => {
              window.history.pushState(null, '', '/login')
              setActivePage('login')
            }}
            addToast={toast}
            onBack={() => {
              window.history.pushState(null, '', '/')
              setActivePage('landing')
            }}
            onBrandClick={() => {
              window.history.pushState(null, '', '/')
              setActivePage('landing')
            }}
          />
          <ToastContainer toasts={toasts} dismiss={dismiss} />
        </>
      )
    }

    if (!showAuth) {
      return (
        <LandingPage
          isLoggedIn={false}
          onGetStarted={() => {
            window.history.pushState(null, '', '/signup')
            setActivePage('signup')
          }}
          onSignIn={() => {
            window.history.pushState(null, '', '/login')
            setActivePage('login')
          }}
          onPricing={() => {
            window.history.pushState(null, '', '/pricing')
            setActivePage('pricing')
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

  if (activePage === 'reset-password' && new URLSearchParams(window.location.search).has('reset_token')) {
    return (
      <>
        <AuthPage onAuth={handleAuth} initialMode="reset" />
        <ToastContainer toasts={toasts} dismiss={dismiss} />
      </>
    )
  }

  if (activePage === 'landing') {
    return (
      <LandingPage
        isLoggedIn={true}
        onGetStarted={() => {
          setActivePage('dashboard')
          window.history.pushState(null, '', '/dashboard')
        }}
        onSignIn={() => {
          setActivePage('dashboard')
          window.history.pushState(null, '', '/dashboard')
        }}
        onPricing={() => {
          setActivePage('pricing')
          window.history.pushState(null, '', '/pricing')
        }}
      />
    )
  }

  if (activePage === 'settings') {
    return (
      <div className={styles.app}>
        <SettingsPage
          theme={theme}
          onToggleTheme={toggleTheme}
          user={user}
          onUserUpdated={(updatedUser) => {
            setUser(updatedUser)
            localStorage.setItem('toolchain_user', JSON.stringify(updatedUser))
          }}
          onSessionsDeleted={() => {
            setSessions([])
            setSessionId(null)
            setMessages([])
          }}
          onLogout={() => { logout(); window.location.reload() }}
          language={language}
          onLanguageChange={setLanguage}
          accentId={accentId}
          onAccentChange={setAccentColor}
          onNavigate={handleNavigate}
          onBack={() => handleNavigate('dashboard')}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarCollapse={() => setSidebarCollapsed((c) => !c)}
        />
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

  return (
    <div className={styles.app}>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onOpenSettings={() => handleNavigate('settings')}
        user={user}
        onLogout={requestLogout}
        onBrandClick={() => { window.history.pushState(null, '', '/'); setActivePage('landing') }}
        mcpCount={mcps.length}
        connectedCount={connectedCount}
        t={t}
      />

      <div className={styles.mobileHeader}>
        <button className={styles.mobileMenuBtn} onClick={() => setSidebarCollapsed(false)}>
          <Menu size={20} />
        </button>
        <div className={styles.mobileHeaderBrand} onClick={() => { window.history.pushState(null, '', '/'); setActivePage('landing') }} style={{ cursor: 'pointer' }}>
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
            weeklyStats={weeklyStats}
            t={t}
          />
        )}

        {activePage === 'mcp-servers' && (
          <MCPServersPage
            mcps={mcps}
            mcpsLoading={mcpsLoading}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onProbe={onProbe}
            onDelete={onDelete}
            onOpenRegister={() => setShowRegister(true)}
            togglingMcp={togglingMcp}
            busy={!!togglingMcp || deleteLoading}
            connectedCount={connectedCount}
            initialSelectedMcp={initialSelectedMcp}
            onClearInitialMcp={() => setInitialSelectedMcp(null)}
          />
        )}

        {activePage === 'pricing' && (
          <PricingPage
            user={user}
            t={t}
            onNavigate={handleNavigate}
            addToast={toast}
            onBack={() => handleNavigate('dashboard')}
            onBrandClick={() => { window.history.pushState(null, '', '/'); setActivePage('landing') }}
            embedded
          />
        )}

        {activePage === 'tool-execution' && (
          <ToolExecutionPage
            connectedMcps={connectedMcps}
            mcpsLoading={mcpsLoading}
            onNavigate={handleNavigate}
            onRunViaAgent={(prompt) => {
              pendingPromptRef.current = prompt
              handleNavigate('chat')
              handleNewChat()
            }}
            t={t}
            persistedState={toolExecState}
            onStateChange={setToolExecState}
            user={user}
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
                  <h1 className={styles.welcomeTitle}>{t('toolchainAI')}</h1>
                  <p className={styles.welcomeSubtitle}>
                    {t('welcomeSubtitle')}
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
                      {t('connectedInfo').replace('{count}', connectedCount).replace('{s}', connectedCount !== 1 ? 's' : '')}
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
                      onEdit={m.role === 'user' && !sending ? handleEditMessage : undefined}
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
              connectedCount={chatEnabledCount}
              onOpenRegister={() => setShowRegister(true)}
              mcps={connectedMcps}
              enabledIds={enabledMcpIds}
              onToggle={onChatToggle}
              t={t}
            />
          </div>
        )}
      </main>

      {showRegister && (
        <RegisterModal onClose={() => setShowRegister(false)} onRegister={onRegister} />
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
