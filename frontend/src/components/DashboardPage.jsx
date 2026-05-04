import { Server, MessageSquare, Plug, Wrench, ArrowRight } from 'lucide-react'
import styles from './DashboardPage.module.css'

export function DashboardPage({ mcps, sessions, connectedCount, onNavigate }) {
  const totalTools = mcps.reduce((acc, m) => acc + (m.tool_count || 0), 0)

  const stats = [
    { label: 'MCP Servers', value: mcps.length, icon: Server, color: 'blue' },
    { label: 'Connected', value: connectedCount, icon: Plug, color: 'green' },
    { label: 'Chat Sessions', value: sessions.length, icon: MessageSquare, color: 'violet' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Overview of your ToolChain AI workspace</p>
      </div>

      <div className={styles.statsGrid}>
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`${styles.statCard} ${styles[s.color]}`}>
              <div className={styles.statIcon}>
                <Icon size={20} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.cardsGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <Server size={18} />
            <h2 className={styles.cardTitle}>MCP Servers</h2>
            <button className={styles.cardAction} onClick={() => onNavigate('mcp-servers')}>
              <span>Manage</span>
              <ArrowRight size={14} />
            </button>
          </div>
          <div className={styles.cardBody}>
            {mcps.length === 0 ? (
              <p className={styles.cardEmpty}>No MCP servers registered yet. Go to MCP Servers to add one.</p>
            ) : (
              <div className={styles.serverList}>
                {mcps.slice(0, 5).map((mcp) => (
                  <div key={mcp.id} className={styles.serverRow}>
                    <div className={`${styles.serverDot} ${mcp.connected ? styles.serverDotOn : ''}`} />
                    <span className={styles.serverName}>{mcp.name}</span>
                    <span className={`${styles.serverStatus} ${mcp.connected ? styles.serverStatusOn : ''}`}>
                      {mcp.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                ))}
                {mcps.length > 5 && (
                  <p className={styles.serverMore}>+{mcps.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <MessageSquare size={18} />
            <h2 className={styles.cardTitle}>Recent Chats</h2>
            <button className={styles.cardAction} onClick={() => onNavigate('chat')}>
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>
          <div className={styles.cardBody}>
            {sessions.length === 0 ? (
              <p className={styles.cardEmpty}>No conversations yet. Start chatting to see history here.</p>
            ) : (
              <div className={styles.chatList}>
                {sessions.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className={styles.chatRow}
                    onClick={() => { onNavigate('chat'); }}
                  >
                    <MessageSquare size={14} className={styles.chatRowIcon} />
                    <span className={styles.chatRowTitle}>{s.title || 'New conversation'}</span>
                  </div>
                ))}
                {sessions.length > 5 && (
                  <p className={styles.serverMore}>+{sessions.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
