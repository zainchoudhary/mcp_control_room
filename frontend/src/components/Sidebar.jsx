import { useState, useRef, useEffect } from 'react'
import {
  PanelLeftClose, PanelLeft, LayoutDashboard, Server, MessageSquare,
  Plus, Trash2, Bot, LogOut, MoreVertical, ChevronDown, ChevronRight,
  Settings, Wrench,
} from 'lucide-react'
import styles from './Sidebar.module.css'

export function Sidebar({
  activePage,
  onNavigate,
  sessions,
  sessionsLoading,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  collapsed,
  onToggleCollapse,
  onOpenSettings,
  user,
  onLogout,
  mcpCount,
  connectedCount,
  t,
}) {
  const [hoveredSession, setHoveredSession] = useState(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [chatExpanded, setChatExpanded] = useState(true)
  const menuRef = useRef(null)
  const collapsedMenuRef = useRef(null)

  useEffect(() => {
    if (!userMenuOpen) return
    const handleClickOutside = (e) => {
      const inMenu = (menuRef.current && menuRef.current.contains(e.target)) ||
        (collapsedMenuRef.current && collapsedMenuRef.current.contains(e.target))
      if (!inMenu) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  useEffect(() => {
    setUserMenuOpen(false)
  }, [collapsed])

  const tr = t || ((k) => k)
  const navItems = [
    { id: 'dashboard', label: tr('dashboard'), icon: LayoutDashboard },
    { id: 'mcp-servers', label: tr('mcpServers'), icon: Server, badge: mcpCount || null },
    { id: 'tool-execution', label: tr('toolExecution'), icon: Wrench },
    { id: 'chat', label: tr('chat'), icon: MessageSquare },
  ]

  return (
    <>
    {!collapsed && <div className={styles.mobileOverlay} onClick={onToggleCollapse} />}
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

          <button
            className={styles.collapsedBtn}
            onClick={onOpenSettings}
            title="Settings"
          >
            <Settings size={18} />
          </button>

          {user && (
            <>
              {userMenuOpen && (
                <div className={styles.collapsedInlineMenu} ref={collapsedMenuRef}>
                  <button
                    className={styles.collapsedInlineBtn}
                    onClick={() => { setUserMenuOpen(false); onLogout() }}
                    title="Sign Out"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              )}
              <button
                className={`${styles.collapsedUserBtn} ${userMenuOpen ? styles.collapsedUserBtnActive : ''}`}
                onClick={() => setUserMenuOpen((v) => !v)}
                title={user.full_name || user.username}
              >
                {(user.full_name || user.username || '?')[0].toUpperCase()}
              </button>
            </>
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
                        <span>{tr('newChat')}</span>
                      </button>
                      <div className={styles.sessions}>
                        {sessionsLoading ? (
                          <div className={styles.sessionsSkeleton}>
                            <div className={styles.skelGroup} />
                            {[1, 2, 3, 4].map(i => (
                              <div key={i} className={styles.skelItem} style={{ animationDelay: `${i * 0.1}s` }} />
                            ))}
                            <div className={styles.skelGroup} style={{ width: '50%', marginTop: 12 }} />
                            {[5, 6].map(i => (
                              <div key={i} className={styles.skelItem} style={{ animationDelay: `${i * 0.1}s` }} />
                            ))}
                          </div>
                        ) : sessions.length === 0 ? (
                          <div className={styles.empty}>{tr('noConversations')}</div>
                        ) : (
                          (() => {
                            const now = new Date()
                            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                            const yesterday = new Date(today - 86400000)
                            const weekAgo = new Date(today - 604800000)

                            const groups = { today: [], yesterday: [], week: [], older: [] }
                            sessions.forEach(s => {
                              const d = new Date(s.created_at)
                              if (d >= today) groups.today.push(s)
                              else if (d >= yesterday) groups.yesterday.push(s)
                              else if (d >= weekAgo) groups.week.push(s)
                              else groups.older.push(s)
                            })

                            const renderGroup = (label, items) => items.length === 0 ? null : (
                              <div key={label}>
                                <div className={styles.sessionGroup}>{label}</div>
                                {items.map(s => (
                                  <button
                                    key={s.id}
                                    className={`${styles.sessionItem} ${s.id === currentSessionId ? styles.active : ''}`}
                                    onClick={() => onSelectSession(s.id)}
                                    onMouseEnter={() => setHoveredSession(s.id)}
                                    onMouseLeave={() => setHoveredSession(null)}
                                  >
                                    <span className={styles.sessionTitle}>{s.title || tr('newConversation')}</span>
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
                                ))}
                              </div>
                            )

                            return <>
                              {renderGroup(tr('today'), groups.today)}
                              {renderGroup(tr('yesterday'), groups.yesterday)}
                              {renderGroup(tr('thisWeek'), groups.week)}
                              {renderGroup(tr('older'), groups.older)}
                            </>
                          })()
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          <div className={styles.bottom}>
            <button className={styles.settingsBtn} onClick={onOpenSettings}>
              <Settings size={15} />
              <span>{tr('settings')}</span>
            </button>

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
                      <span>{tr('signOut')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
    </>
  )
}
