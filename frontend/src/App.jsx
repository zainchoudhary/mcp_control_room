import { useEffect, useMemo, useRef, useState } from 'react'
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
import { Plus } from 'lucide-react'
import styles from './App.module.css'

export default function App() {
  const [mcps, setMcps] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [showConnectors, setShowConnectors] = useState(false)
  const [connectorView, setConnectorView] = useState('menu')
  const { toasts, toast, dismiss } = useToast()
  const composerMenuRef = useRef(null)

  const connectedCount = useMemo(() => mcps.filter((m) => m.connected).length, [mcps])

  const refreshMCPs = async () => {
    const data = await listMCPs()
    setMcps(data)
  }

  useEffect(() => {
    refreshMCPs().catch((err) => toast(err.message, 'error'))
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (composerMenuRef.current && !composerMenuRef.current.contains(event.target)) {
        setShowConnectors(false)
        setConnectorView('menu')
      }
    }

    window.addEventListener('mousedown', handleOutsideClick)
    return () => window.removeEventListener('mousedown', handleOutsideClick)
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
      <div className={styles.backdropA} />
      <div className={styles.backdropB} />
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
          <div className={styles.headerCopy}>
            <div className={styles.eyebrow}>MCP Agent Control Room</div>
            <h1 className={styles.title}>MCP Agent Dashboard</h1>
            <p className={styles.subtitle}>
              Manage connected tools, inspect server status, and chat with your agent from one workspace.
            </p>
          </div>

          <div className={styles.headerMeta}>
            <div className={styles.metaPill}>
              <span className={styles.metaLabel}>Active MCPs</span>
              <span className={styles.metaValue}>{connectedCount}</span>
            </div>
            <div className={styles.metaPill}>
              <span className={styles.metaLabel}>Session</span>
              <span className={styles.metaValue}>{sessionId ? 'Connected' : 'Fresh'}</span>
            </div>
          </div>
        </header>

        <section className={styles.chatArea}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyBadge}>Waiting for input</div>
              <h2>Ready to chat</h2>
              <p>Connect MCP servers from the left and start asking questions.</p>
              <div className={styles.emptyHints}>
                <span>Probe servers before connecting</span>
                <span>Stream responses in real time</span>
                <span>Keep tools visible in the registry</span>
              </div>
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
          <div className={styles.composerCard} ref={composerMenuRef}>
            <div className={styles.composerTop}>
              <div>
                <div className={styles.composerLabel}>Message</div>
                <div className={styles.composerHint}>Use connectors, then send a prompt to the agent</div>
              </div>
              <div className={styles.composerStatus}>{sending ? 'Streaming…' : 'Idle'}</div>
            </div>

            <div className={styles.composerRow}>
              <div className={styles.connectorWrap}>
                <button
                  type="button"
                  className={styles.connectorButton}
                  onClick={() => {
                    setShowConnectors((value) => !value)
                    setConnectorView('menu')
                  }}
                  aria-label="Open connectors"
                >
                  <Plus size={18} />
                </button>

                {showConnectors && (
                  <div className={styles.connectorMenu}>
                    {connectorView === 'menu' ? (
                      <div className={styles.connectorPrimaryMenu}>
                        <button
                          type="button"
                          className={styles.connectorPrimaryItem}
                          onClick={() => setConnectorView('list')}
                        >
                          <div className={styles.connectorPrimaryLeft}>
                            <div className={styles.connectorPrimaryTitle}>Connectors</div>
                            <div className={styles.connectorPrimaryHint}>View registered MCPs</div>
                          </div>
                          <span className={styles.connectorPrimaryArrow}>›</span>
                        </button>
                      </div>
                    ) : (
                      <div className={styles.connectorListView}>
                        <div className={styles.connectorList}>
                          {mcps.length === 0 ? (
                            <div className={styles.connectorEmpty}>No connectors registered yet.</div>
                          ) : (
                            mcps.map((mcp) => (
                              <div key={mcp.id} className={styles.connectorItem}>
                                <div className={styles.connectorItemMeta}>
                                  <div className={styles.connectorItemName}>{mcp.name}</div>
                                  <div className={styles.connectorItemSub}>
                                    {mcp.connected ? 'Connected' : 'Disconnected'} · {mcp.transport}
                                  </div>
                                </div>

                                <div className={styles.connectorItemActions}>
                                  <label className={styles.connectorSwitch}>
                                    <input
                                      type="checkbox"
                                      checked={mcp.connected}
                                      onChange={() => (mcp.connected ? onDisconnect(mcp.id) : onConnect(mcp.id))}
                                      aria-label={`${mcp.name} connector toggle`}
                                    />
                                    <span className={styles.connectorTrack}>
                                      <span className={styles.connectorKnob} />
                                    </span>
                                  </label>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <div className={styles.connectorMenuHeader}>
                          <button
                            type="button"
                            className={styles.connectorBackBtn}
                            onClick={() => setConnectorView('menu')}
                          >
                            ‹ Back
                          </button>
                          <div>
                            <div className={styles.connectorMenuTitle}>Connectors</div>
                            <div className={styles.connectorMenuHint}>Switch MCP tools on or off</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

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
            </div>
          </div>
        </footer>
      </main>

      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} onRegister={onRegister} />}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
