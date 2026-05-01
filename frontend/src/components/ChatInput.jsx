import { useRef, useEffect, useCallback, useState } from 'react'
import { ArrowUp, Plus, Loader2, Search, Trash2, Server, ChevronRight, ArrowLeft } from 'lucide-react'
import styles from './ChatInput.module.css'

export function ChatInput({
  value,
  onChange,
  onSend,
  sending,
  mcps,
  onConnect,
  onDisconnect,
  onProbe,
  onDelete,
  onOpenRegister,
  connectedCount,
}) {
  const textareaRef = useRef(null)
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [view, setView] = useState('main')

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

  useEffect(() => { autoResize() }, [value, autoResize])
  useEffect(() => { textareaRef.current?.focus() }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
        setView('main')
      }
    }
    if (menuOpen) window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const toggleMenu = () => {
    setMenuOpen(o => !o)
    setView('main')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const canSend = value.trim() && !sending

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={styles.inputArea}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message ToolChain AI..."
            className={styles.textarea}
            rows={1}
            disabled={sending}
          />
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft} ref={menuRef}>
            <button
              type="button"
              className={`${styles.plusBtn} ${menuOpen ? styles.plusBtnActive : ''}`}
              onClick={toggleMenu}
              title="MCP Connectors"
            >
              <Plus size={18} />
              {connectedCount > 0 && (
                <span className={styles.badge}>{connectedCount}</span>
              )}
            </button>

            {menuOpen && (
              <div className={styles.menu}>
                {view === 'main' ? (
                  <MainMenu
                    onConnectors={() => setView('connectors')}
                    onRegister={() => { setMenuOpen(false); setView('main'); onOpenRegister() }}
                    connectedCount={connectedCount}
                    totalCount={mcps.length}
                  />
                ) : (
                  <ConnectorsList
                    mcps={mcps}
                    onBack={() => setView('main')}
                    onConnect={onConnect}
                    onDisconnect={onDisconnect}
                    onProbe={onProbe}
                    onDelete={onDelete}
                    onRegister={() => { setMenuOpen(false); setView('main'); onOpenRegister() }}
                  />
                )}
              </div>
            )}
          </div>

          <button
            className={`${styles.sendBtn} ${canSend ? styles.sendActive : ''}`}
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
          >
            {sending ? <Loader2 size={18} className={styles.spinner} /> : <ArrowUp size={18} />}
          </button>
        </div>
      </div>
      <p className={styles.disclaimer}>
        ToolChain AI can make mistakes. Verify important information.
      </p>
    </div>
  )
}

function MainMenu({ onConnectors, onRegister, connectedCount, totalCount }) {
  return (
    <div className={styles.mainMenu}>
      <button className={styles.menuItem} onClick={onConnectors}>
        <div className={styles.menuItemIcon}>
          <Server size={16} />
        </div>
        <div className={styles.menuItemText}>
          <span className={styles.menuItemTitle}>Connectors</span>
          <span className={styles.menuItemHint}>
            {totalCount === 0
              ? 'No servers registered'
              : `${connectedCount} of ${totalCount} connected`}
          </span>
        </div>
        <ChevronRight size={16} className={styles.menuItemArrow} />
      </button>

      <button className={styles.menuItem} onClick={onRegister}>
        <div className={styles.menuItemIcon}>
          <Plus size={16} />
        </div>
        <div className={styles.menuItemText}>
          <span className={styles.menuItemTitle}>Register Server</span>
          <span className={styles.menuItemHint}>Add a new MCP server</span>
        </div>
      </button>
    </div>
  )
}

function ConnectorsList({ mcps, onBack, onConnect, onDisconnect, onProbe, onDelete, onRegister }) {
  return (
    <div className={styles.connectorsList}>
      <div className={styles.listHeader}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <span className={styles.listTitle}>Connectors</span>
          <span className={styles.listHint}>Toggle MCP servers on or off</span>
        </div>
      </div>

      <div className={styles.listBody}>
        {mcps.length === 0 ? (
          <div className={styles.listEmpty}>
            <p>No servers registered yet</p>
            <button className={styles.listRegisterBtn} onClick={onRegister}>
              Register a server
            </button>
          </div>
        ) : (
          mcps.map((mcp) => (
            <ConnectorRow
              key={mcp.id}
              mcp={mcp}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onProbe={onProbe}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ConnectorRow({ mcp, onConnect, onDisconnect, onProbe, onDelete }) {
  const [probing, setProbing] = useState(false)
  const [tools, setTools] = useState(null)
  const [error, setError] = useState(null)

  const handleProbe = async (e) => {
    e.stopPropagation()
    if (tools !== null) {
      setTools(null)
      return
    }
    setProbing(true)
    setError(null)
    try {
      const res = await onProbe(mcp.id)
      if (res.ok) setTools(res.tools || [])
      else setError(res.error || 'Probe failed')
    } catch (err) {
      setError(err.message)
    } finally {
      setProbing(false)
    }
  }

  const handleToggle = () => {
    if (mcp.connected) onDisconnect(mcp.id)
    else onConnect(mcp.id)
  }

  return (
    <div className={`${styles.row} ${mcp.connected ? styles.rowActive : ''}`}>
      <div className={styles.rowMain}>
        <div className={styles.rowInfo} onClick={handleToggle}>
          <div className={`${styles.rowDot} ${mcp.connected ? styles.rowDotOn : ''}`} />
          <div className={styles.rowText}>
            <span className={styles.rowName}>{mcp.name}</span>
          </div>
        </div>
        <label className={styles.toggle} onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={mcp.connected} onChange={handleToggle} />
          <span className={styles.toggleTrack}>
            <span className={styles.toggleKnob} />
          </span>
        </label>
      </div>

      <div className={styles.rowActions}>
        <button className={styles.rowAction} onClick={handleProbe} disabled={probing}>
          <Search size={12} />
          <span>{probing ? 'Loading...' : tools !== null ? 'Hide Tools' : 'Tools'}</span>
        </button>
        <button
          className={`${styles.rowAction} ${styles.rowActionDanger}`}
          onClick={(e) => { e.stopPropagation(); onDelete(mcp.id, mcp.name) }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {error && <div className={styles.rowError}>{error}</div>}

      {tools !== null && (
        <div className={styles.rowTools}>
          {tools.length === 0 ? (
            <span className={styles.rowToolsEmpty}>No tools</span>
          ) : (
            tools.map(t => <span key={t} className={styles.toolChip}>{t}</span>)
          )}
        </div>
      )}
    </div>
  )
}
