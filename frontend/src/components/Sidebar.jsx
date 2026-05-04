import { useState, useRef, useEffect } from 'react'
import {
  PanelLeftClose, PanelLeft, LayoutDashboard, Server, MessageSquare,
  Plus, Trash2, Bot, Sun, Moon, LogOut, MoreVertical, ChevronDown, ChevronRight,
  Settings, Check,
} from 'lucide-react'
import styles from './Sidebar.module.css'

export function Sidebar({
  activePage,
  onNavigate,
  sessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  collapsed,
  onToggleCollapse,
  theme,
  onToggleTheme,
  user,
  onLogout,
  mcpCount,
  connectedCount,
}) {
  const [hoveredSession, setHoveredSession] = useState(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [chatExpanded, setChatExpanded] = useState(true)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const menuRef = useRef(null)
  const prefsRef = useRef(null)

  useEffect(() => {
    if (!userMenuOpen && !prefsOpen) return
    const handleClickOutside = (e) => {
      if (userMenuOpen && menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false)
      if (prefsOpen && prefsRef.current && !prefsRef.current.contains(e.target)) setPrefsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen, prefsOpen])

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'mcp-servers', label: 'MCP Servers', icon: Server, badge: mcpCount || null },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
  ]

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.top}>
        <button className={styles.toggleBtn} onClick={onToggleCollapse} title={collapsed ? 'Open sidebar' : 'Close sidebar'}>
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
        {!collapsed && (
          <div className={styles.brand}>
            <div className={styles.brandIcon}><Bot size={16} /></div>
            <span className={styles.brandName}>ToolChain AI</span>
          </div>
        )}
      </div>

      {collapsed ? (
        <div className={styles.collapsedNav}>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`${styles.collapsedBtn} ${activePage === item.id ? styles.collapsedBtnActive : ''}`}
                onClick={() => onNavigate(item.id)}
                title={item.label}
              >
                <Icon size={18} />
              </button>
            )
          })}

          <div className={styles.collapsedSpacer} />

          <div className={styles.collapsedPrefsWrap} ref={prefsRef}>
            <button
              className={`${styles.collapsedBtn} ${prefsOpen ? styles.collapsedBtnActive : ''}`}
              onClick={() => setPrefsOpen((v) => !v)}
              title="Preferences"
            >
              <Settings size={18} />
            </button>
            {prefsOpen && (
              <div className={styles.collapsedPrefsMenu}>
                <div className={styles.prefsLabel}>Theme</div>
                <button
                  className={`${styles.prefsOption} ${theme === 'light' ? styles.prefsOptionActive : ''}`}
                  onClick={() => { if (theme !== 'light') onToggleTheme(); }}
                >
                  <Sun size={14} />
                  <span>Light</span>
                  {theme === 'light' && <Check size={14} className={styles.prefsCheck} />}
                </button>
                <button
                  className={`${styles.prefsOption} ${theme === 'dark' ? styles.prefsOptionActive : ''}`}
                  onClick={() => { if (theme !== 'dark') onToggleTheme(); }}
                >
                  <Moon size={14} />
                  <span>Dark</span>
                  {theme === 'dark' && <Check size={14} className={styles.prefsCheck} />}
                </button>
              </div>
            )}
          </div>

          {user && (
            <div className={styles.collapsedUserWrap} ref={menuRef}>
              <button
                className={`${styles.collapsedUserBtn} ${userMenuOpen ? styles.collapsedUserBtnActive : ''}`}
                onClick={() => setUserMenuOpen((v) => !v)}
                title={user.full_name || user.username}
              >
                {(user.full_name || user.username || '?')[0].toUpperCase()}
              </button>
              {userMenuOpen && (
                <div className={styles.collapsedUserMenu}>
                  <button
                    className={styles.userMenuItem}
                    onClick={() => { setUserMenuOpen(false); onLogout() }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <nav className={styles.nav}>
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activePage === item.id
              const isChat = item.id === 'chat'

              return (
                <div key={item.id}>
                  <button
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    onClick={() => {
                      onNavigate(item.id)
                      if (isChat) setChatExpanded(true)
                    }}
                  >
                    <Icon size={17} />
                    <span className={styles.navLabel}>{item.label}</span>
                    {item.badge != null && <span className={styles.navBadge}>{item.badge}</span>}
                    {isChat && (
                      <button
                        className={styles.expandBtn}
                        onClick={(e) => { e.stopPropagation(); setChatExpanded((v) => !v) }}
                      >
                        {chatExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </button>

                  {isChat && isActive && chatExpanded && (
                    <div className={styles.chatSub}>
                      <button className={styles.newChatBtn} onClick={onNewChat}>
                        <Plus size={14} />
                        <span>New Chat</span>
                      </button>
                      <div className={styles.sessions}>
                        {sessions.length === 0 ? (
                          <div className={styles.empty}>No conversations yet</div>
                        ) : (
                          sessions.map((s) => (
                            <button
                              key={s.id}
                              className={`${styles.sessionItem} ${s.id === currentSessionId ? styles.active : ''}`}
                              onClick={() => onSelectSession(s.id)}
                              onMouseEnter={() => setHoveredSession(s.id)}
                              onMouseLeave={() => setHoveredSession(null)}
                            >
                              <span className={styles.sessionTitle}>{s.title || 'New conversation'}</span>
                              {hoveredSession === s.id && (
                                <button
                                  className={styles.deleteSessionBtn}
                                  onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id) }}
                                  title="Delete"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          <div className={styles.bottom}>
            <div className={styles.prefsWrap} ref={prefsRef}>
              <button
                className={`${styles.prefsBtn} ${prefsOpen ? styles.prefsBtnActive : ''}`}
                onClick={() => setPrefsOpen((v) => !v)}
              >
                <Settings size={15} />
                <span>Preferences</span>
              </button>
              {prefsOpen && (
                <div className={styles.prefsMenu}>
                  <div className={styles.prefsLabel}>Theme</div>
                  <button
                    className={`${styles.prefsOption} ${theme === 'light' ? styles.prefsOptionActive : ''}`}
                    onClick={() => { if (theme !== 'light') onToggleTheme(); }}
                  >
                    <Sun size={14} />
                    <span>Light</span>
                    {theme === 'light' && <Check size={14} className={styles.prefsCheck} />}
                  </button>
                  <button
                    className={`${styles.prefsOption} ${theme === 'dark' ? styles.prefsOptionActive : ''}`}
                    onClick={() => { if (theme !== 'dark') onToggleTheme(); }}
                  >
                    <Moon size={14} />
                    <span>Dark</span>
                    {theme === 'dark' && <Check size={14} className={styles.prefsCheck} />}
                  </button>
                </div>
              )}
            </div>

            {user && (
              <div className={styles.userRow} ref={menuRef}>
                <div className={styles.userAvatar}>
                  {(user.full_name || user.username || '?')[0].toUpperCase()}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.full_name || user.username}</span>
                  <span className={styles.userEmail}>{user.email}</span>
                </div>
                <button
                  className={`${styles.dotsBtn} ${userMenuOpen ? styles.dotsBtnActive : ''}`}
                  onClick={() => setUserMenuOpen((v) => !v)}
                  title="Options"
                >
                  <MoreVertical size={16} />
                </button>
                {userMenuOpen && (
                  <div className={styles.userMenu}>
                    <button
                      className={styles.userMenuItem}
                      onClick={() => { setUserMenuOpen(false); onLogout() }}
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
