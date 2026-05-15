import { useState, useEffect, useRef } from 'react'
import {
  Plus, Server, Search, Trash2, Loader2, ExternalLink, Wifi, WifiOff,
  Plug, X, Clock, Globe, Layers, Wrench, Copy, Check, ChevronRight, ChevronDown,
  MoreVertical, Power, PowerOff,
} from 'lucide-react'
import styles from './MCPServersPage.module.css'

export function MCPServersPage({
  mcps,
  mcpsLoading,
  onConnect,
  onDisconnect,
  onProbe,
  onDelete,
  onOpenRegister,
  togglingMcp,
  busy,
  connectedCount,
  initialSelectedMcp,
  onClearInitialMcp,
}) {
  const [selectedMcp, setSelectedMcp] = useState(null)
  const [toolsMcp, setToolsMcp] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

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

  const q = searchQuery.toLowerCase()
  const filteredMcps = q
    ? mcps.filter(m => m.name?.toLowerCase().includes(q) || m.url?.toLowerCase().includes(q))
    : mcps

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
        <button className={styles.addBtn} onClick={onOpenRegister} disabled={busy}>
          <Plus size={16} />
          <span>Register Server</span>
        </button>
      </div>

      {!mcpsLoading && mcps.length > 0 && (
        <div className={styles.searchBar}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search MCP Servers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.searchClear} onClick={() => setSearchQuery('')} type="button">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {mcpsLoading ? (
        <div className={styles.grid}>
          {[1, 2, 3].map(i => (
            <div key={i} className={styles.skelCard} style={{ animationDelay: `${i * 0.12}s` }}>
              <div className={styles.skelCardHeader}>
                <div className={styles.skelCardIcon} />
                <div className={styles.skelCardLines}>
                  <div className={styles.skelLine} style={{ width: '60%' }} />
                  <div className={styles.skelLine} style={{ width: '40%', height: 8 }} />
                </div>
              </div>
              <div className={styles.skelCardBody}>
                <div className={styles.skelLine} style={{ width: '80%' }} />
                <div className={styles.skelLine} style={{ width: '50%' }} />
              </div>
              <div className={styles.skelCardFooter}>
                <div className={styles.skelLine} style={{ width: '30%', height: 28, borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      ) : mcps.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Server size={40} />
          </div>
          <h2 className={styles.emptyTitle}>No MCP Servers</h2>
          <p className={styles.emptyText}>
            Register your first MCP server to enable tool-assisted AI conversations.
          </p>
          <button className={styles.emptyBtn} onClick={onOpenRegister} disabled={busy}>
            <Plus size={16} />
            <span>Register Server</span>
          </button>
        </div>
      ) : filteredMcps.length === 0 ? (
        <div className={styles.noResults}>
          <Search size={20} />
          <span>No servers matching "{searchQuery}"</span>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredMcps.map((mcp) => (
            <ServerCard
              key={mcp.id}
              mcp={mcp}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onDelete={onDelete}
              isToggling={togglingMcp === mcp.id}
              busy={busy}
              onOpen={() => setSelectedMcp(mcp)}
              onOpenTools={() => setToolsMcp(mcp)}
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
          onDelete={(id, name) => { onDelete(id, name) }}
          isToggling={togglingMcp === selectedMcp.id}
          busy={busy}
        />
      )}

      {toolsMcp && (
        <ToolsModal
          mcp={mcps.find((m) => m.id === toolsMcp.id) || toolsMcp}
          onClose={() => setToolsMcp(null)}
          onProbe={onProbe}
        />
      )}
    </div>
  )
}

function ServerCard({ mcp, onConnect, onDisconnect, onDelete, isToggling, busy, onOpen, onOpenTools }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const disabled = busy || isToggling

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
    if (disabled) return
    if (mcp.connected) onDisconnect(mcp.id)
    else onConnect(mcp.id)
  }

  const handleDelete = () => {
    setMenuOpen(false)
    if (disabled) return
    onDelete(mcp.id, mcp.name)
  }

  return (
    <div
      className={`${styles.card} ${mcp.connected ? styles.cardConnected : ''} ${disabled ? styles.cardBusy : ''}`}
      onClick={disabled ? undefined : onOpen}
      style={disabled ? { pointerEvents: isToggling ? 'auto' : 'none', opacity: isToggling ? 1 : 0.6 } : undefined}
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
            disabled={disabled}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && !disabled && (
            <div className={styles.dotsMenu}>
              {mcp.connected ? (
                <button className={styles.dotsMenuItem} onClick={handleToggle}>
                  <PowerOff size={14} />
                  <span>Disconnect</span>
                </button>
              ) : (
                <button className={styles.dotsMenuItem} onClick={handleToggle}>
                  <Power size={14} />
                  <span>Connect</span>
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
        <button
          className={styles.toolsLink}
          onClick={(e) => { e.stopPropagation(); onOpenTools() }}
          disabled={disabled}
        >
          <Wrench size={12} /> Available Tools
        </button>
        <span className={styles.viewDetail}>
          View Details <ChevronRight size={14} />
        </span>
      </div>
    </div>
  )
}


function ServerDetailModal({ mcp, onClose, onConnect, onDisconnect, onDelete, isToggling, busy }) {
  const [copiedField, setCopiedField] = useState(null)
  const overlayRef = useRef(null)
  const disabled = busy || isToggling

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape' && !disabled) onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose, disabled])

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current && !disabled) onClose()
  }

  const handleToggle = () => {
    if (disabled) return
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
          <button className={styles.closeBtn} onClick={onClose} disabled={disabled}>
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
        </div>

        <div className={styles.modalFooter}>
          <button
            className={`${styles.footerBtn} ${styles.footerBtnDanger}`}
            onClick={() => onDelete(mcp.id, mcp.name)}
            disabled={disabled}
          >
            <Trash2 size={14} />
            <span>Delete Server</span>
          </button>
          <div className={styles.footerRight}>
            <button className={styles.footerBtn} onClick={onClose} disabled={disabled}>
              Cancel
            </button>
            {mcp.connected ? (
              <button
                className={`${styles.footerBtn} ${styles.footerBtnDisconnect}`}
                onClick={handleToggle}
                disabled={disabled}
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
            ) : (
              <button
                className={`${styles.footerBtn} ${styles.footerBtnConnect}`}
                onClick={handleToggle}
                disabled={disabled}
              >
                {isToggling ? (
                  <Loader2 size={14} className={styles.toggleSpinner} />
                ) : (
                  <>
                    <Wifi size={14} />
                    <span>Connect</span>
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

function ToolsModal({ mcp, onClose, onProbe }) {
  const [probing, setProbing] = useState(true)
  const [tools, setTools] = useState(null)
  const [probeError, setProbeError] = useState(null)
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
      .catch((err) => { if (active) setProbeError(err.message) })
      .finally(() => { if (active) setProbing(false) })
    return () => { active = false }
  }, [mcp.id])

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <div className={`${styles.modalIcon} ${mcp.connected ? styles.modalIconOn : ''}`}>
              <Wrench size={20} />
            </div>
            <div>
              <h2 className={styles.modalTitle}>Available Tools</h2>
              <span className={styles.modalStatus}>
                {mcp.name}
                {!probing && tools && <> · {tools.length} tool{tools.length !== 1 ? 's' : ''}</>}
              </span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.modalBody}>
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
              >Retry</button>
            </div>
          ) : tools && tools.length === 0 ? (
            <div className={styles.toolsEmpty}>No tools found on this server.</div>
          ) : tools ? (
            <div className={styles.toolsBody}>
              <ToolsList tools={tools} />
            </div>
          ) : null}
        </div>

        <div className={styles.modalFooter} style={{ justifyContent: 'flex-end' }}>
          <button className={styles.footerBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function ToolsList({ tools }) {
  const [openName, setOpenName] = useState(null)

  return (
    <div className={styles.toolsList}>
      {tools.map((t) => {
        const name = typeof t === 'string' ? t : t.name
        const desc = typeof t === 'object' ? t.description : null
        const params = typeof t === 'object' ? t.parameters : null
        const isOpen = openName === name
        return (
          <ToolItem
            key={name}
            name={name}
            description={desc}
            parameters={params}
            isOpen={isOpen}
            onToggle={() => setOpenName(isOpen ? null : name)}
          />
        )
      })}
    </div>
  )
}

function ToolItem({ name, description, parameters, isOpen, onToggle }) {
  const props = parameters?.properties || {}
  const required = new Set(parameters?.required || [])
  const entries = Object.entries(props)

  const typeColor = (t) => {
    if (!t) return ''
    if (t === 'string') return styles.tString
    if (t === 'number' || t === 'integer') return styles.tNumber
    if (t === 'boolean') return styles.tBool
    if (t === 'array') return styles.tArray
    if (t === 'object') return styles.tObject
    return ''
  }

  return (
    <div className={`${styles.toolCard} ${isOpen ? styles.toolCardOpen : ''}`}>
      <button className={styles.toolCardHeader} onClick={onToggle} type="button">
        <span className={styles.toolCardName}>{name}</span>
        <span className={styles.toolCardMeta}>
          {entries.length > 0 && <span className={styles.toolCardBadge}>{entries.length} params</span>}
          <ChevronDown size={14} className={`${styles.toolCardChev} ${isOpen ? styles.toolCardChevOpen : ''}`} />
        </span>
      </button>

      {isOpen && (
        <div className={styles.toolCardBody}>
          {description && <p className={styles.toolCardDesc}>{description}</p>}

          {entries.length > 0 ? (
            <table className={styles.paramTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([key, val]) => (
                  <tr key={key} className={required.has(key) ? styles.paramRowReq : ''}>
                    <td><code className={styles.paramName}>{key}</code></td>
                    <td><span className={`${styles.paramType} ${typeColor(val.type)}`}>{val.type || '—'}</span></td>
                    <td>
                      {required.has(key)
                        ? <span className={styles.paramYes}>Yes</span>
                        : <span className={styles.paramNo}>No</span>
                      }
                    </td>
                    <td className={styles.paramDescCol}>
                      {val.description || <span className={styles.paramEmpty}>—</span>}
                      {val.default !== undefined && (
                        <span className={styles.paramDefault}>Default: <code>{JSON.stringify(val.default)}</code></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : !description ? (
            <p className={styles.toolNoInfo}>No parameters or description available.</p>
          ) : null}
        </div>
      )}
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
