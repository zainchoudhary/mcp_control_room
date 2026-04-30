import { useState } from 'react'
import { Trash2, Wifi, WifiOff, Search, ChevronDown, ChevronUp } from 'lucide-react'
import styles from './MCPCard.module.css'

export function MCPCard({ mcp, onConnect, onDisconnect, onProbe, onDelete }) {
  const [probing, setProbing] = useState(false)
  const [tools, setTools] = useState(null)
  const [probeError, setProbeError] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const handleProbe = async () => {
    setProbing(true)
    setProbeError(null)
    try {
      const result = await onProbe(mcp.id)
      if (result.ok) {
        setTools(result.tools || [])
        setExpanded(true)
      } else {
        setProbeError(result.error || 'Probe failed')
        setTools(null)
      }
    } catch (err) {
      setProbeError(err.message)
    } finally {
      setProbing(false)
    }
  }

  return (
    <div className={`${styles.card} ${mcp.connected ? styles.connected : ''}`}>
      <div className={styles.top}>
        <div className={styles.info}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{mcp.name}</span>
            <span className={`${styles.badge} ${mcp.connected ? styles.badgeOn : styles.badgeOff}`}>
              {mcp.connected ? 'Live' : 'Offline'}
            </span>
            <span className={styles.transportBadge}>{mcp.transport}</span>
          </div>
          <div className={styles.url}>{mcp.url}</div>
          {mcp.description && <div className={styles.desc}>{mcp.description}</div>}
        </div>
        <button className={styles.deleteBtn} onClick={() => onDelete(mcp.id, mcp.name)} title="Delete">
          <Trash2 size={13} />
        </button>
      </div>

      <div className={styles.actions}>
        {mcp.connected ? (
          <button className={`${styles.btn} ${styles.btnDisconnect}`} onClick={() => onDisconnect(mcp.id)}>
            <WifiOff size={12} /> Disconnect
          </button>
        ) : (
          <button className={`${styles.btn} ${styles.btnConnect}`} onClick={() => onConnect(mcp.id)}>
            <Wifi size={12} /> Connect
          </button>
        )}

        <button className={`${styles.btn} ${styles.btnProbe}`} onClick={handleProbe} disabled={probing}>
          <Search size={12} /> {probing ? 'Probing…' : 'Probe'}
        </button>

        {tools !== null && (
          <button className={`${styles.btn} ${styles.btnToggle}`} onClick={() => setExpanded((e) => !e)}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {tools.length} tool{tools.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {probeError && <div className={styles.probeError}>⚠ {probeError}</div>}

      {tools !== null && expanded && (
        <div className={styles.toolsSection}>
          {tools.length === 0 ? (
            <span className={styles.noTools}>No tools found</span>
          ) : (
            <div className={styles.toolsList}>
              {tools.map((t) => (
                <span key={t} className={styles.toolTag}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
