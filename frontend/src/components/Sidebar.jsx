import { useState } from 'react'
import { Plus, MessageSquare, PanelLeftClose, PanelLeft, Server, Trash2, Bot } from 'lucide-react'
import styles from './Sidebar.module.css'

export function Sidebar({
  sessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onOpenRegister,
  mcpCount,
  collapsed,
  onToggleCollapse,
}) {
  const [hoveredSession, setHoveredSession] = useState(null)

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.top}>
        <button className={styles.toggleBtn} onClick={onToggleCollapse} title={collapsed ? 'Open sidebar' : 'Close sidebar'}>
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
        {!collapsed && (
          <button className={styles.newChatBtn} onClick={onNewChat} title="New chat">
            <Plus size={18} />
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>
              <Bot size={18} />
            </div>
            <div className={styles.brandText}>
              <span className={styles.brandName}>MCP Agent</span>
              <span className={styles.brandTag}>AI-Powered Tools</span>
            </div>
          </div>

          <div className={styles.sectionLabel}>Conversations</div>

          <nav className={styles.sessions}>
            {sessions.length === 0 ? (
              <div className={styles.empty}>
                <MessageSquare size={20} className={styles.emptyIcon} />
                <span>No conversations yet</span>
                <span className={styles.emptyHint}>Start a new chat to begin</span>
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  className={`${styles.sessionItem} ${s.id === currentSessionId ? styles.active : ''}`}
                  onClick={() => onSelectSession(s.id)}
                  onMouseEnter={() => setHoveredSession(s.id)}
                  onMouseLeave={() => setHoveredSession(null)}
                >
                  <MessageSquare size={15} />
                  <span className={styles.sessionTitle}>{s.title || 'New conversation'}</span>
                  {hoveredSession === s.id && (
                    <button
                      className={styles.deleteSessionBtn}
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id) }}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </button>
              ))
            )}
          </nav>

          <div className={styles.bottom}>
            <button className={styles.bottomBtn} onClick={onOpenRegister}>
              <Server size={16} />
              <span>MCP Servers</span>
              {mcpCount > 0 && <span className={styles.badge}>{mcpCount}</span>}
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
