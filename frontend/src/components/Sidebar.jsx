import { Plus, Server } from 'lucide-react'
import styles from './Sidebar.module.css'

export function Sidebar({ mcps, onAdd, onConnect, onDisconnect, onProbe, onDelete }) {
  const connected = mcps.filter((m) => m.connected).length
  const total = mcps.length

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.titleIcon}>
            <Server size={14} />
          </div>
          <span className={styles.title}>MCP Registry</span>
        </div>

        <button className={styles.addBtn} onClick={onAdd}>
          <Plus size={14} />
          <span>Register Server</span>
        </button>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Total</span>
          <span className={styles.statValue}>{total}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.stat}>
          <span className={styles.statLabel}>Connected</span>
          <span className={`${styles.statValue} ${connected > 0 ? styles.statActive : ''}`}>{connected}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.stat}>
          <span className={styles.statLabel}>Status</span>
          <span className={`${styles.statDot} ${connected > 0 ? styles.statDotActive : ''}`} />
          <span className={styles.statStatus}>{connected > 0 ? 'Tools Active' : 'No Active'}</span>
        </div>
      </div>

      <div className={styles.list}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>⬡</div>
          <div className={styles.emptyTitle}>Registered MCPs stay in the connector menu</div>
          <div className={styles.emptySub}>Use the composer plus button to view and toggle them.</div>
        </div>
      </div>
    </aside>
  )
}
