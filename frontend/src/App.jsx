import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  createSession,
  createGhostSession,
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
  uploadChatAttachment,
  deleteChatAttachment,
  fetchAttachmentBlob,
} from './api.js'
import { formatUserMessageForDisplay, parseUserMessageContent } from './utils/chatAttachments.js'
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
import { AllChatsPage } from './components/AllChatsPage.jsx'
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage.jsx'
import { useToast } from './hooks/useToast.js'
import { useTheme } from './hooks/useTheme.js'
import { useLanguage } from './hooks/useLanguage.js'
import { useAccentColor } from './hooks/useAccentColor.js'
import { usePreferences, getStartupPage } from './hooks/usePreferences.js'
import { applyCustomBg } from './utils/customBackground.js'
import { registerCurrentDevice } from './utils/registerDevice.js'
import { WebsiteLockOverlay } from './components/WebsiteLockOverlay.jsx'
import { shouldShowLock, clearUnlockSession } from './utils/websiteLock.js'
import { GhostLaunchOverlay } from './components/GhostLaunchOverlay.jsx'
import { Bot, Menu, Ghost } from 'lucide-react'
import styles from './App.module.css'

const APP_PAGES = ['dashboard', 'mcp-servers', 'tool-execution', 'chat', 'all-chats', 'pricing', 'settings', 'privacy-policy']
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
  const { theme, toggleTheme } = useTheme(user?.id)
  const { language, setLanguage, t } = useLanguage(user?.id)
  const { accentId, setAccentColor } = useAccentColor(user?.id)
  const { prefs, setPref, togglePref } = usePreferences(user?.id)
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => prefs.sidebarCollapsedDefault)
  const [searchFocusToken, setSearchFocusToken] = useState(0)
  const [streamingId, setStreamingId] = useState(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [chatAttachments, setChatAttachments] = useState([])
  const [pendingUploads, setPendingUploads] = useState([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [dataLoading, setDataLoading] = useState(!!savedUser)
  const [weeklyStats, setWeeklyStats] = useState(null)
  const [toolExecState, setToolExecState] = useState({ mcpId: null, toolName: null, tools: null, formCache: {} })
  const [appLocked, setAppLocked] = useState(false)
  const [ghostMode, setGhostMode] = useState(false)
  const [ghostLaunching, setGhostLaunching] = useState(false)
  const ghostSessionIdRef = useRef(null)
  const preGhostSessionRef = useRef(null)
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
  const attachmentUrlsRef = useRef([])
  const streamPendingRef = useRef('')
  const streamFlushTimerRef = useRef(null)
  const STREAM_RENDER_MS = 45

  const flushStreamContent = useCallback((assistantId) => {
    if (streamFlushTimerRef.current) {
      clearTimeout(streamFlushTimerRef.current)
      streamFlushTimerRef.current = null
    }
    const delta = streamPendingRef.current
    streamPendingRef.current = ''
    if (!delta) return
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId ? { ...m, content: m.content + delta } : m
      )
    )
  }, [])

  const appendStreamContent = useCallback((assistantId, chunk) => {
    if (!chunk) return
    streamPendingRef.current += chunk
    if (streamFlushTimerRef.current) return
    streamFlushTimerRef.current = setTimeout(() => {
      streamFlushTimerRef.current = null
      flushStreamContent(assistantId)
    }, STREAM_RENDER_MS)
  }, [flushStreamContent])

  const appendStreamLine = useCallback((assistantId, line) => {
    flushStreamContent(assistantId)
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId ? { ...m, content: m.content + line } : m
      )
    )
  }, [flushStreamContent])

  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then(async (u) => {
        if (cancelled) return
        if (u) {
          setUser(u)
          setDataLoading(false)
          await registerCurrentDevice(u.id)
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
        const startPage = getStartupPage(user.id)
        setActivePage(startPage)
        window.history.replaceState(null, '', `/${startPage}`)
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

  useEffect(() => {
    document.documentElement.classList.toggle('no-animations', !prefs.animationsEnabled)
  }, [prefs.animationsEnabled])

  useEffect(() => {
    if (!user) {
      applyCustomBg('')
      return
    }
    applyCustomBg(prefs.customBg || '')
  }, [prefs.customBg, user])

  useEffect(() => {
    if (!user) return
    setSidebarCollapsed(prefs.sidebarCollapsedDefault)
  }, [user?.id, prefs.sidebarCollapsedDefault])

  const handleNavigate = useCallback((page) => {
    setActivePage(page)
    window.history.pushState(null, '', `/${page}`)
  }, [])

  const focusChatSearch = useCallback(() => {
    if (!user) return
    handleNavigate('chat')
    setSidebarCollapsed(false)
    setSearchFocusToken((t) => t + 1)
  }, [user, handleNavigate])

  useEffect(() => {
    if (!user) return
    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      const el = document.activeElement
      const typing = el && (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
      )
      if (typing) return

      const key = e.key.toLowerCase()
      if (key === 'b') {
        e.preventDefault()
        setSidebarCollapsed((c) => !c)
      } else if (key === 'n' && e.altKey) {
        e.preventDefault()
        setSessionId(null)
        setMessages([])
        setStreamingId(null)
        setInput('')
        setActivePage('chat')
        window.history.pushState(null, '', '/chat')
      } else if (e.key === ',' || key === ',') {
        e.preventDefault()
        handleNavigate('settings')
      } else if (key === 'k') {
        e.preventDefault()
        focusChatSearch()
      } else if (key === 'd') {
        e.preventDefault()
        handleNavigate('dashboard')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [user, handleNavigate, focusChatSearch])

  useEffect(() => {
    if (user) setAppLocked(shouldShowLock(user.id, user.security))
    else setAppLocked(false)
  }, [user?.id, user?.security])

  const handleAuth = async (userData) => {
    setUser(userData)
    setAppLocked(shouldShowLock(userData.id, userData.security))
    setDataLoading(false)
    await registerCurrentDevice(userData.id)
    const urlPage = getPageFromUrl()
    const onAuthRoute = AUTH_PAGES.includes(urlPage)
    const startPage = onAuthRoute ? getStartupPage(userData.id) : (
      APP_PAGES.includes(urlPage) ? urlPage : getStartupPage(userData.id)
    )
    setActivePage(startPage)
    window.history.replaceState(null, '', `/${startPage}`)
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
          clearUnlockSession(user?.id)
          logout()
          setUser(null)
          setAppLocked(false)
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
    const interval = setInterval(refreshMCPs, 15000)
    return () => clearInterval(interval)
  }, [user, activePage, refreshMCPs])

  useEffect(() => {
    if (!user || (activePage !== 'chat' && activePage !== 'all-chats')) return
    refreshSessions()
    if (activePage === 'chat') refreshMCPs()
  }, [user, activePage])

  useEffect(() => {
    if (!user || activePage !== 'tool-execution') return
    refreshMCPs()
  }, [user, activePage])


  const ensureSession = async () => {
    if (ghostMode) {
      if (ghostSessionIdRef.current) return ghostSessionIdRef.current
      const data = await createGhostSession()
      ghostSessionIdRef.current = data.id
      setSessionId(data.id)
      return data.id
    }
    if (sessionId) return sessionId
    const data = await createSession()
    setSessions((prev) => [data, ...prev])
    setSessionId(data.id)
    return data.id
  }

  const buildGhostHistory = useCallback((msgs) => {
    return msgs.map((m) => ({
      role: m.role,
      content:
        m.role === 'user'
          ? (m.rawContent ?? parseUserMessageContent(m.content).text)
          : m.content,
    }))
  }, [])

  const clearComposerAttachments = useCallback(() => {
    attachmentUrlsRef.current.forEach((url) => {
      if (url) URL.revokeObjectURL(url)
    })
    attachmentUrlsRef.current = []
    setChatAttachments([])
    setPendingUploads((prev) => {
      prev.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
      })
      return []
    })
  }, [])

  const wipeGhostSession = useCallback(async () => {
    const gid = ghostSessionIdRef.current
    ghostSessionIdRef.current = null
    if (gid) {
      try {
        await deleteSessionApi(gid)
      } catch {
        /* ignore */
      }
    }
  }, [])

  const exitGhostMode = useCallback(async ({ silent = false } = {}) => {
    if (sending) return
    await wipeGhostSession()
    setGhostMode(false)
    setGhostLaunching(false)
    clearComposerAttachments()
    setMessages([])
    setStreamingId(null)
    setInput('')
    const restore = preGhostSessionRef.current
    preGhostSessionRef.current = null
    if (restore?.sessionId) {
      setSessionId(restore.sessionId)
      setMessages(restore.messages || [])
    } else {
      setSessionId(null)
    }
    if (!silent) toast(t('ghostModeOff') || 'Ghost mode ended — no traces saved.', 'success')
  }, [sending, wipeGhostSession, clearComposerAttachments, toast, t])

  const finishGhostLaunch = useCallback(() => {
    setGhostLaunching(false)
    setGhostMode(true)
    toast(t('ghostModeOn') || 'Ghost mode active — anonymous & ephemeral.', 'success')
  }, [toast, t])

  const handleToggleGhostMode = () => {
    if (ghostMode) {
      setConfirmDialog({
        title: t('ghostExitTitle') || 'Exit Ghost Mode?',
        message: t('ghostExitMessage') || 'All messages in this ghost session will vanish immediately. Nothing is saved.',
        confirmLabel: t('ghostExitConfirm') || 'Exit & Erase',
        icon: 'delete',
        variant: 'danger',
        onConfirm: async () => {
          setConfirmDialog(null)
          await exitGhostMode()
        },
      })
      return
    }
    if (sending) return
    preGhostSessionRef.current = {
      sessionId,
      messages: [...messages],
    }
    setSessionId(null)
    ghostSessionIdRef.current = null
    setMessages([])
    setStreamingId(null)
    setInput('')
    clearComposerAttachments()
    setGhostLaunching(true)
  }

  useEffect(() => {
    return () => {
      if (ghostSessionIdRef.current) {
        deleteSessionApi(ghostSessionIdRef.current).catch(() => {})
        ghostSessionIdRef.current = null
      }
    }
  }, [])

  const handleAddFiles = async (files) => {
    if (!files?.length) return

    const batch = files.map((file) => {
      const isImage = file.type.startsWith('image/')
      const previewUrl = isImage ? URL.createObjectURL(file) : null
      if (previewUrl) attachmentUrlsRef.current.push(previewUrl)
      return {
        tempId: crypto.randomUUID(),
        name: file.name,
        kind: isImage ? 'image' : 'document',
        previewUrl,
        file,
      }
    })

    setPendingUploads((prev) => [
      ...prev,
      ...batch.map(({ file, ...rest }) => rest),
    ])
    setUploadingFiles(true)

    try {
      const sid = await ensureSession()
      for (const item of batch) {
        try {
          const att = await uploadChatAttachment(sid, item.file)
          let previewUrl = item.previewUrl
          if (att.kind === 'image' && !previewUrl) {
            try {
              const blob = await fetchAttachmentBlob(sid, att.id)
              previewUrl = URL.createObjectURL(blob)
              attachmentUrlsRef.current.push(previewUrl)
            } catch {
              /* ignore */
            }
          }
          setChatAttachments((prev) => [...prev, { ...att, previewUrl }])
        } catch (err) {
          toast(err.message, 'error')
        } finally {
          if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl)
            attachmentUrlsRef.current = attachmentUrlsRef.current.filter((u) => u !== item.previewUrl)
          }
          setPendingUploads((prev) => prev.filter((p) => p.tempId !== item.tempId))
        }
      }
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleRemoveAttachment = async (attachmentId) => {
    const pending = pendingUploads.find((p) => p.tempId === attachmentId)
    if (pending) {
      if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl)
      setPendingUploads((prev) => prev.filter((p) => p.tempId !== attachmentId))
      return
    }

    const att = chatAttachments.find((a) => a.id === attachmentId)
    if (att?.previewUrl) {
      URL.revokeObjectURL(att.previewUrl)
      attachmentUrlsRef.current = attachmentUrlsRef.current.filter((u) => u !== att.previewUrl)
    }
    setChatAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
    if (sessionId) {
      try {
        await deleteChatAttachment(sessionId, attachmentId)
      } catch (err) {
        toast(err.message, 'error')
      }
    }
  }

  const send = async (overrideText) => {
    const text = (typeof overrideText === 'string' ? overrideText : input).trim()
    const hasAttachments = chatAttachments.length > 0
    if ((!text && !hasAttachments) || sending || uploadingFiles) return

    const messageText =
      text || 'Please review the attached file(s) and answer my questions about them.'
    const sentAttachments = [...chatAttachments]
    const attachmentIds = sentAttachments.map((a) => a.id)

    setInput('')
    clearComposerAttachments()
    setSending(true)

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: formatUserMessageForDisplay(messageText, sentAttachments),
      rawContent: messageText,
    }
    const assistantId = crypto.randomUUID()
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setStreamingId(assistantId)

    try {
      const sid = await ensureSession()
      const ghostHistory = ghostMode ? buildGhostHistory(messages) : null

      streamPendingRef.current = ''
      for await (const event of streamChat(sid, messageText, [...enabledMcpIds], attachmentIds, {
        ghostMode,
        ghostHistory,
      })) {
        if (event.type === 'session_title' && event.title && !ghostMode) {
          setSessions((prev) =>
            prev.map((s) => (s.id === sid ? { ...s, title: event.title } : s))
          )
        }
        if (event.type === 'token') {
          appendStreamContent(assistantId, event.content || '')
        }
        if (event.type === 'phase' && event.status === 'done') {
          const detail = (event.detail || '').replace(/\|/g, ' ').replace(/\n/g, ' ')
          const line = `Phase: ${event.role}|done|${detail}\n`
          appendStreamLine(assistantId, line)
        }
        if (event.type === 'tool_use') {
          const line = `Tool: ${event.tool}(${JSON.stringify(event.input || {})})\n`
          appendStreamLine(assistantId, line)
        }
        if (event.type === 'tool_result') {
          let displayContent = event.content || ''
          try {
            const parsed = JSON.parse(displayContent)
            displayContent = JSON.stringify(parsed, null, 2)
          } catch {}
          const encoded = btoa(unescape(encodeURIComponent(displayContent)))
          const line = `Result: ${event.tool} -> @@JSON@@${encoded}@@END@@\n`
          appendStreamLine(assistantId, line)
        }
        if (event.type === 'error') {
          const msg = event.content || 'Stream error'
          toast(msg, 'error')
        }
      }
      flushStreamContent(assistantId)
    } catch (err) {
      toast(err.message, 'error')
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: 'Failed to get response. Please try again.' } : m
        )
      )
    } finally {
      flushStreamContent(assistantId)
      setSending(false)
      setStreamingId(null)
    }
  }

  const handleEditMessage = async (messageId, newText) => {
    if (sending) return
    const idx = messages.findIndex((m) => m.id === messageId)
    if (idx === -1) return

    const kept = messages.slice(0, idx)
    const editedMsg = { ...messages[idx], content: newText, rawContent: newText }
    const assistantId = crypto.randomUUID()

    setMessages([...kept, editedMsg, { id: assistantId, role: 'assistant', content: '' }])
    setStreamingId(assistantId)
    setSending(true)
    setInput('')

    try {
      const sid = await ensureSession()
      const attachmentIds = chatAttachments.map((a) => a.id)
      const ghostHistory = ghostMode ? buildGhostHistory(kept) : null
      streamPendingRef.current = ''
      for await (const event of streamChat(sid, newText, [...enabledMcpIds], attachmentIds, {
        ghostMode,
        ghostHistory,
      })) {
        if (event.type === 'token') {
          appendStreamContent(assistantId, event.content || '')
        }
        if (event.type === 'phase' && event.status === 'done') {
          const detail = (event.detail || '').replace(/\|/g, ' ').replace(/\n/g, ' ')
          const line = `Phase: ${event.role}|done|${detail}\n`
          appendStreamLine(assistantId, line)
        }
        if (event.type === 'tool_use') {
          const line = `Tool: ${event.tool}(${JSON.stringify(event.input || {})})\n`
          appendStreamLine(assistantId, line)
        }
        if (event.type === 'tool_result') {
          let displayContent = event.content || ''
          try { displayContent = JSON.stringify(JSON.parse(displayContent), null, 2) } catch {}
          const encoded = btoa(unescape(encodeURIComponent(displayContent)))
          const line = `Result: ${event.tool} -> @@JSON@@${encoded}@@END@@\n`
          appendStreamLine(assistantId, line)
        }
        if (event.type === 'error') {
          const msg = event.content || 'Stream error'
          toast(msg, 'error')
        }
      }
      flushStreamContent(assistantId)
    } catch (err) {
      toast(err.message, 'error')
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: 'Failed to get response. Please try again.' } : m)
      )
    } finally {
      flushStreamContent(assistantId)
      setSending(false)
      setStreamingId(null)
    }
  }

  const handleNewChat = () => {
    if (ghostMode) {
      wipeGhostSession().then(() => {
        setSessionId(null)
        setMessages([])
        setStreamingId(null)
        setInput('')
        clearComposerAttachments()
        setActivePage('chat')
        window.history.pushState(null, '', '/chat')
      })
      return
    }
    clearComposerAttachments()
    setSessionId(null)
    setMessages([])
    setStreamingId(null)
    setInput('')
    setActivePage('chat')
    window.history.pushState(null, '', '/chat')
  }

  useEffect(() => () => clearComposerAttachments(), [clearComposerAttachments])

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
    if (ghostMode) {
      toast(t('ghostSelectBlocked') || 'Exit ghost mode to open saved chats.', 'error')
      return
    }
    if (id === sessionId && activePage === 'chat') return
    setSessionId(id)
    setMessages([])
    setStreamingId(null)
    setLoadingMessages(true)
    setActivePage('chat')
    window.history.pushState(null, '', '/chat')
    try {
      clearComposerAttachments()
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

  const handleDeleteSessions = (ids) => {
    if (ids.length === 0) return Promise.resolve(false)
    const count = ids.length
    return new Promise((resolve) => {
      setConfirmDialog({
        title: count === 1 ? 'Delete Conversation' : `Delete ${count} Conversations`,
        message: count === 1
          ? 'Delete this conversation? All messages will be lost.'
          : `Delete ${count} conversations? All messages will be lost. This cannot be undone.`,
        confirmLabel: 'Delete',
        icon: 'delete',
        variant: 'danger',
        onDismiss: () => resolve(false),
        onConfirm: async () => {
          setConfirmDialog(null)
          const results = await Promise.allSettled(ids.map((id) => deleteSessionApi(id)))
          const deleted = ids.filter((_, i) => results[i].status === 'fulfilled')
          if (deleted.length > 0) {
            setSessions((prev) => prev.filter((s) => !deleted.includes(s.id)))
            if (deleted.includes(sessionId)) {
              handleNewChat()
            }
          }
          if (deleted.length < ids.length) {
            toast('Some conversations could not be deleted.', 'error')
          } else if (deleted.length > 1) {
            toast(`${deleted.length} conversations deleted`, 'success')
          }
          resolve(deleted.length > 0)
        },
      })
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
                .catch((err) => toast(err.message || 'Connection failed', 'error'))
                .finally(() => setTogglingMcp(null))
            }
          }
        }, 500)
        return
      }
      if (result?.connected) {
        await refreshMCPs()
        toast('Connected', 'success')
      }
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
          prefs={prefs}
          onSetPref={setPref}
          onTogglePref={togglePref}
        />
        {confirmDialog && (
          <ConfirmDialog
            open
            title={confirmDialog.title}
            message={confirmDialog.message}
            confirmLabel={confirmDialog.confirmLabel}
            icon={confirmDialog.icon}
            animation={confirmDialog.animation}
            variant={confirmDialog.variant}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => {
              if (logoutLoading || deleteLoading) return
              confirmDialog.onDismiss?.()
              setConfirmDialog(null)
            }}
            loading={logoutLoading || deleteLoading}
          />
        )}
        <ToastContainer toasts={toasts} dismiss={dismiss} />
        {user && appLocked && user.security?.lock_pin_set && (
          <WebsiteLockOverlay
            user={user}
            security={user.security}
            onUnlocked={() => setAppLocked(false)}
          />
        )}
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
        searchFocusToken={searchFocusToken}
        ghostMode={ghostMode}
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

        {activePage === 'privacy-policy' && (
          <PrivacyPolicyPage
            onBack={() => handleNavigate('dashboard')}
            language={language}
          />
        )}

        {activePage === 'all-chats' && (
          <AllChatsPage
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            currentSessionId={sessionId}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
            onDeleteSessions={handleDeleteSessions}
            t={t}
          />
        )}

        {activePage === 'chat' && (
          <div className={`${styles.chatPage} ${ghostMode ? styles.chatPageGhost : ''}`}>
            <div className={styles.chatTopBar}>
              <div className={styles.chatTopBarLeft}>
                {ghostMode && (
                  <span className={styles.ghostLiveBadge}>
                    <span className={styles.ghostLiveDot} />
                    {t('ghostModeActive') || 'Ghost Mode — Anonymous'}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={`${styles.ghostModeBtn} ${ghostMode ? styles.ghostModeBtnOn : ''}`}
                onClick={handleToggleGhostMode}
                disabled={sending || ghostLaunching}
                title={ghostMode ? (t('ghostModeExit') || 'Exit Ghost Mode') : (t('ghostModeEnter') || 'Enter Ghost Mode')}
              >
                <Ghost size={16} />
                <span>{ghostMode ? (t('ghostModeExit') || 'Exit Ghost') : (t('ghostMode') || 'Ghost Mode')}</span>
              </button>
            </div>

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
                  <div className={`${styles.welcomeIcon} ${ghostMode ? styles.welcomeIconGhost : ''}`}>
                    {ghostMode ? <Ghost size={40} /> : <Bot size={40} />}
                  </div>
                  <h1 className={styles.welcomeTitle}>
                    {ghostMode ? (t('ghostWelcomeTitle') || 'Anonymous Channel') : t('toolchainAI')}
                  </h1>
                  <p className={styles.welcomeSubtitle}>
                    {ghostMode
                      ? (t('ghostWelcomeSubtitle') || 'No history. No identity. Messages vanish when you leave.')
                      : t('welcomeSubtitle')}
                  </p>
                  {!ghostMode && (
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
                  )}
                  {ghostMode && (
                    <p className={styles.ghostHint}>
                      {t('ghostHint') || 'Your account is hidden. Nothing from this chat is saved or appears in history.'}
                    </p>
                  )}
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
                      sessionId={sessionId}
                      isStreaming={m.id === streamingId}
                      onEdit={m.role === 'user' && !sending && !ghostMode ? handleEditMessage : undefined}
                      ghostMode={ghostMode}
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
              attachments={chatAttachments}
              pendingUploads={pendingUploads}
              onAddFiles={handleAddFiles}
              onRemoveAttachment={handleRemoveAttachment}
              uploadingFiles={uploadingFiles}
              language={language}
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
          animation={confirmDialog.animation}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => {
            if (logoutLoading || deleteLoading) return
            confirmDialog.onDismiss?.()
            setConfirmDialog(null)
          }}
          loading={logoutLoading || deleteLoading}
        />
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <GhostLaunchOverlay active={ghostLaunching} onComplete={finishGhostLaunch} />
      {user && appLocked && user.security?.lock_pin_set && (
        <WebsiteLockOverlay
          user={user}
          security={user.security}
          onUnlocked={() => setAppLocked(false)}
        />
      )}
    </div>
  )
}
