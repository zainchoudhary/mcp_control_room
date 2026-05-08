import { useRef, useEffect, useCallback, useState } from 'react'
import { ArrowUp, Loader2, Plus, Server, Plug, ChevronRight } from 'lucide-react'
import styles from './ChatInput.module.css'

export function ChatInput({
  value,
  onChange,
  onSend,
  sending,
  connectedCount,
  onOpenRegister,
  mcps,
  enabledIds,
  onToggle,
}) {
  const textareaRef = useRef(null)
  const wrapperRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showConnectors, setShowConnectors] = useState(false)

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

  useEffect(() => { autoResize() }, [value, autoResize])
  useEffect(() => { textareaRef.current?.focus() }, [])

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMenuOpen(false)
        setShowConnectors(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const toggleMenu = () => {
    setMenuOpen((v) => {
      if (v) setShowConnectors(false)
      return !v
    })
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
          <div className={styles.toolbarLeft} ref={wrapperRef}>
            <button
              type="button"
              className={`${styles.plusBtn} ${menuOpen ? styles.plusBtnActive : ''}`}
              onClick={toggleMenu}
              title="Options"
            >
              <Plus size={18} />
              {connectedCount > 0 && (
                <span className={styles.badge}>{connectedCount}</span>
              )}
            </button>

            {menuOpen && (
              <div className={styles.floatingGroup}>
                <div className={styles.plusMenu}>
                  <button
                    className={`${styles.plusMenuItem} ${showConnectors ? styles.plusMenuItemActive : ''}`}
                    onClick={() => setShowConnectors((v) => !v)}
                  >
                    <div className={styles.plusMenuIcon}><Plug size={15} /></div>
                    <div className={styles.plusMenuText}>
                      <span className={styles.plusMenuTitle}>Connectors</span>
                      <span className={styles.plusMenuHint}>
                        {mcps.length === 0 ? 'No servers connected' : `${connectedCount} of ${mcps.length} enabled`}
                      </span>
                    </div>
                    <ChevronRight size={15} className={`${styles.plusMenuArrow} ${showConnectors ? styles.arrowRotated : ''}`} />
                  </button>
                  <button
                    className={styles.plusMenuItem}
                    onClick={() => { setMenuOpen(false); setShowConnectors(false); onOpenRegister() }}
                  >
                    <div className={styles.plusMenuIcon}><Server size={15} /></div>
                    <div className={styles.plusMenuText}>
                      <span className={styles.plusMenuTitle}>Register Server</span>
                      <span className={styles.plusMenuHint}>Add a new MCP server</span>
                    </div>
                  </button>
                </div>

                {showConnectors && (
                  <div className={styles.connPanel}>
                    <div className={styles.connPanelBody}>
                      {mcps.length === 0 ? (
                        <div className={styles.connPanelEmpty}>
                          <div className={styles.emptyIcon}><Plug size={22} /></div>
                          <p>No servers connected</p>
                          <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 4 }}>Connect servers from the MCP Servers page</p>
                        </div>
                      ) : (
                        mcps.map((mcp) => (
                          <ConnectorRow
                            key={mcp.id}
                            mcp={mcp}
                            enabled={enabledIds.has(mcp.id)}
                            onToggle={onToggle}
                          />
                        ))
                      )}
                    </div>
                    {mcps.length > 0 && (
                      <div className={styles.connPanelFooter}>
                        {connectedCount} of {mcps.length} enabled
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {connectedCount > 0 && (
              <span className={styles.connectedBadge}>
                <span className={styles.connectedDot} />
                {connectedCount} MCP{connectedCount !== 1 ? 's' : ''} connected
              </span>
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

function ConnectorRow({ mcp, enabled, onToggle }) {
  return (
    <div className={styles.connRow}>
      <div className={styles.connInfo}>
        <div className={styles.connIconWrap}>
          {mcp.icon ? (
            <img src={mcp.icon} alt="" className={styles.connIcon} onError={(e) => { e.target.style.display = 'none' }} />
          ) : (
            <Server size={14} className={styles.connIconFallback} />
          )}
          <div className={`${styles.connDot} ${enabled ? styles.connDotOn : ''}`} />
        </div>
        <div className={styles.connDetails}>
          <span className={styles.connName}>{mcp.name}</span>
        </div>
      </div>
      <button
        className={`${styles.switchTrack} ${enabled ? styles.switchOn : ''}`}
        onClick={() => onToggle(mcp.id)}
        aria-label={enabled ? 'Disable' : 'Enable'}
      >
        <span className={styles.switchThumb} />
      </button>
    </div>
  )
}
