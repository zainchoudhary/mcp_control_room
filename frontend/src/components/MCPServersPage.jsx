import { useState, useEffect, useRef } from 'react'
import {
  Plus, Server, Search, Trash2, Loader2, ExternalLink, Wifi, WifiOff,
  Plug, X, Clock, Globe, Layers, Wrench, Copy, Check, ChevronRight,
  MoreVertical, Power, PowerOff,
} from 'lucide-react'
import styles from './MCPServersPage.module.css'

export function MCPServersPage({
  mcps,
  onConnect,
  onDisconnect,
  onProbe,
  onDelete,
  onOpenRegister,
  togglingMcp,
  connectedCount,
  initialSelectedMcp,
  onClearInitialMcp,
}) {
  const [selectedMcp, setSelectedMcp] = useState(null)

  useEffect(() => {
    if (initialSelectedMcp) {
      const found = mcps.find((m) => m.id === initialSelectedMcp.id)
      if (found) setSelectedMcp(found)
      onClearInitialMcp && onClearInitialMcp()
    }
  }, [initialSelectedMcp])

  useEffect(() => {
    if (selectedMcp && !mcps.find((m) => m.id === selectedMcp.id)) {
      setSelectedMcp(null)
    }
  }, [mcps, selectedMcp])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>MCP Servers</h1>
          <p className={styles.subtitle}>
            {mcps.length} server{mcps.length !== 1 ? 's' : ''} registered
            {connectedCount > 0 && ` · ${connectedCount} connected`}
          </p>
        </div>
        <button className={styles.addBtn} onClick={onOpenRegister}>
          <Plus size={16} />
          <span>Register Server</span>
        </button>
      </div>

      {mcps.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Server size={40} />
          </div>
          <h2 className={styles.emptyTitle}>No MCP Servers</h2>
          <p className={styles.emptyText}>
            Register your first MCP server to enable tool-assisted AI conversations.
          </p>
          <button className={styles.emptyBtn} onClick={onOpenRegister}>
            <Plus size={16} />
            <span>Register Server</span>
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {mcps.map((mcp) => (
            <ServerCard
              key={mcp.id}
              mcp={mcp}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onDelete={onDelete}
              isToggling={togglingMcp === mcp.id}
              onOpen={() => setSelectedMcp(mcp)}
            />
          ))}
        </div>
      )}

      {selectedMcp && (
        <ServerDetailModal
          mcp={mcps.find((m) => m.id === selectedMcp.id) || selectedMcp}
          onClose={() => setSelectedMcp(null)}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onProbe={onProbe}
          onDelete={(id, name) => { onDelete(id, name) }}
          isToggling={togglingMcp === selectedMcp.id}
        />
      )}
    </div>
  )
}

function ServerCard({ mcp, onConnect, onDisconnect, onDelete, isToggling, onOpen }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handleToggle = () => {
    setMenuOpen(false)
    if (isToggling) return
    if (mcp.connected) onDisconnect(mcp.id)
    else onConnect(mcp.id)
  }

  const handleDelete = () => {
    setMenuOpen(false)
    onDelete(mcp.id, mcp.name)
  }

  return (
    <div
      className={`${styles.card} ${mcp.connected ? styles.cardConnected : ''}`}
      onClick={onOpen}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardIconWrap}>
          {mcp.icon ? (
            <img src={mcp.icon} alt="" className={styles.cardIcon} onError={(e) => { e.target.style.display = 'none' }} />
          ) : (
            <Server size={18} className={styles.cardIconFallback} />
          )}
          {isToggling ? (
            <Loader2 size={10} className={`${styles.statusBadge} ${styles.statusSpinner}`} />
          ) : (
            <div className={`${styles.statusBadge} ${mcp.connected ? styles.statusBadgeOn : ''}`} />
          )}
        </div>
        <h3 className={styles.cardName}>{mcp.name}</h3>
        <div className={styles.dotsWrap} ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button
            className={`${styles.dotsBtn} ${menuOpen ? styles.dotsBtnActive : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            title="Options"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className={styles.dotsMenu}>
              {mcp.connected && (
                <button className={styles.dotsMenuItem} onClick={handleToggle}>
                  <PowerOff size={14} />
                  <span>Disconnect</span>
                </button>
              )}
              <button className={`${styles.dotsMenuItem} ${styles.dotsMenuDanger}`} onClick={handleDelete}>
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {mcp.description && (
        <p className={styles.cardDesc}>{mcp.description}</p>
      )}

      <div className={styles.cardMeta}>
        <div className={styles.metaItem}>
          <ExternalLink size={12} />
          <span className={styles.metaUrl}>{mcp.url}</span>
        </div>
        <div className={styles.metaItem}>
          {mcp.connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{mcp.connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.viewDetail}>
          View Details <ChevronRight size={14} />
        </span>
      </div>
    </div>
  )
}


function ServerDetailModal({ mcp, onClose, onConnect, onDisconnect, onProbe, onDelete, isToggling }) {
  const [probing, setProbing] = useState(false)
  const [tools, setTools] = useState(null)
  const [probeError, setProbeError] = useState(null)
  const [copiedField, setCopiedField] = useState(null)
  const overlayRef = useRef(null)

  useEffect(() => {
    let active = true
    setProbing(true)
    setProbeError(null)
    onProbe(mcp.id)
      .then((res) => {
        if (!active) return
        if (res.ok) setTools(res.tools || [])
        else setProbeError(res.error || 'Probe failed')
      })
      .catch((err) => {
        if (active) setProbeError(err.message)
      })
      .finally(() => { if (active) setProbing(false) })
    return () => { active = false }
  }, [mcp.id])

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape' && !isToggling) onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose, isToggling])

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current && !isToggling) onClose()
  }

  const handleToggle = () => {
    if (isToggling) return
    if (mcp.connected) onDisconnect(mcp.id)
    else onConnect(mcp.id)
  }

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const createdDate = mcp.created_at
    ? new Date(mcp.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Unknown'

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <div className={`${styles.modalIcon} ${mcp.connected ? styles.modalIconOn : ''}`}>
              {mcp.icon ? (
                <img src={mcp.icon} alt="" className={styles.modalIconImg} onError={(e) => { e.target.replaceWith(document.createElement('span')) }} />
              ) : (
                <Server size={22} />
              )}
            </div>
            <div>
              <h2 className={styles.modalTitle}>{mcp.name}</h2>
              <span className={`${styles.modalStatus} ${mcp.connected ? styles.modalStatusOn : ''}`}>
                <span className={styles.modalStatusDot} />
                {mcp.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} disabled={isToggling}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {mcp.description && (
            <div className={styles.descSection}>
              <p className={styles.descText}>{mcp.description}</p>
            </div>
          )}

          <div className={styles.detailsGrid}>
            <DetailRow
              icon={Globe}
              label="Endpoint URL"
              value={mcp.url}
              mono
              onCopy={() => copyToClipboard(mcp.url, 'url')}
              copied={copiedField === 'url'}
            />
            <DetailRow
              icon={Layers}
              label="Transport"
              value={mcp.transport.toUpperCase()}
            />
            <DetailRow
              icon={Clock}
              label="Registered"
              value={createdDate}
            />
            <DetailRow
              icon={Plug}
              label="Server ID"
              value={mcp.id}
              mono
              onCopy={() => copyToClipboard(mcp.id, 'id')}
              copied={copiedField === 'id'}
            />
          </div>

          <div className={styles.toolsSection}>
            <div className={styles.toolsHeader}>
              <Wrench size={16} />
              <span className={styles.toolsTitle}>Available Tools</span>
              {probing && <Loader2 size={14} className={styles.toolsLoader} />}
              {!probing && tools && (
                <span className={styles.toolsCount}>{tools.length}</span>
              )}
            </div>

            <div className={styles.toolsBody}>
              {probing ? (
                <div className={styles.toolsProbing}>
                  <Loader2 size={20} className={styles.toolsLoader} />
                  <span>Loading tools...</span>
                </div>
              ) : probeError ? (
                <div className={styles.toolsError}>
                  <span>{probeError}</span>
                  <button
                    className={styles.retryBtn}
                    onClick={() => {
                      setProbing(true)
                      setProbeError(null)
                      onProbe(mcp.id)
                        .then((res) => {
                          if (res.ok) setTools(res.tools || [])
                          else setProbeError(res.error || 'Probe failed')
                        })
                        .catch((err) => setProbeError(err.message))
                        .finally(() => setProbing(false))
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : tools && tools.length === 0 ? (
                <div className={styles.toolsEmpty}>No tools found on this server.</div>
              ) : tools ? (
                <div className={styles.toolsGrid}>
                  {tools.map((t) => (
                    <div key={t} className={styles.toolItem}>
                      <Wrench size={12} className={styles.toolItemIcon} />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            className={`${styles.footerBtn} ${styles.footerBtnDanger}`}
            onClick={() => onDelete(mcp.id, mcp.name)}
            disabled={isToggling}
          >
            <Trash2 size={14} />
            <span>Delete Server</span>
          </button>
          <div className={styles.footerRight}>
            <button className={styles.footerBtn} onClick={onClose} disabled={isToggling}>
              Cancel
            </button>
            {mcp.connected && (
              <button
                className={`${styles.footerBtn} ${styles.footerBtnDisconnect}`}
                onClick={handleToggle}
                disabled={isToggling}
              >
                {isToggling ? (
                  <Loader2 size={14} className={styles.toggleSpinner} />
                ) : (
                  <>
                    <WifiOff size={14} />
                    <span>Disconnect</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ icon: Icon, label, value, mono, onCopy, copied }) {
  return (
    <div className={styles.detailRow}>
      <div className={styles.detailLabel}>
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <div className={styles.detailValue}>
        <span className={mono ? styles.mono : ''}>{value}</span>
        {onCopy && (
          <button className={styles.copyBtn} onClick={onCopy} title="Copy">
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  )
}
