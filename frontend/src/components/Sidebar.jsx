import { useState } from 'react'
import { Plus, MessageSquare, PanelLeftClose, PanelLeft, Server, Trash2, Bot, Sun, Moon } from 'lucide-react'
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
  theme,
  onToggleTheme,
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
              <span className={styles.brandName}>ToolChain AI</span>
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
            <div className={styles.themeRow}>
              <div className={styles.themeLabel}>
                {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </div>
              <button className={styles.themeSwitch} onClick={onToggleTheme} title="Toggle theme">
                <span className={`${styles.themeSwitchTrack} ${theme === 'light' ? styles.themeSwitchLight : ''}`}>
                  <span className={styles.themeSwitchKnob}>
                    {theme === 'dark' ? <Moon size={10} /> : <Sun size={10} />}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
