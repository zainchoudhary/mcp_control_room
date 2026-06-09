import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  PanelLeftClose, PanelLeft, LayoutDashboard, Server, MessageSquare,
  Plus, Trash2, Bot, LogOut, MoreVertical, ChevronDown, ChevronRight,
  Settings, Wrench, Crown, Zap, Sparkles, Search, X, Ghost,
} from 'lucide-react'
import styles from './Sidebar.module.css'

function groupSessionsByDate(sessions) {
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
  return groups
}

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
  onBrandClick,
  mcpCount,
  connectedCount,
  searchFocusToken = 0,
  ghostMode = false,
  t,
}) {
  const [hoveredSession, setHoveredSession] = useState(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [chatExpanded, setChatExpanded] = useState(true)
  const [sessionSearch, setSessionSearch] = useState('')
  const [searchPopupOpen, setSearchPopupOpen] = useState(false)
  const menuRef = useRef(null)
  const collapsedMenuRef = useRef(null)
  const searchInputRef = useRef(null)
  const searchPopupRef = useRef(null)

  const popupSessions = useMemo(() => {
    if (!sessionSearch.trim()) return sessions
    const q = sessionSearch.toLowerCase()
    return sessions.filter(s => (s.title || '').toLowerCase().includes(q))
  }, [sessions, sessionSearch])

  const closeSearchPopup = useCallback(() => {
    setSearchPopupOpen(false)
    setSessionSearch('')
  }, [])

  const openSearchPopup = useCallback(() => {
    if (ghostMode) return
    setSearchPopupOpen(true)
  }, [ghostMode])

  const handlePopupSelectSession = useCallback((id) => {
    onNavigate('chat')
    onSelectSession(id)
    closeSearchPopup()
  }, [onNavigate, onSelectSession, closeSearchPopup])

  useEffect(() => {
    if (!searchPopupOpen) return
    const rafId = requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    return () => cancelAnimationFrame(rafId)
  }, [searchPopupOpen])

  useEffect(() => {
    if (!searchPopupOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeSearchPopup()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [searchPopupOpen, closeSearchPopup])

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

  useEffect(() => {
    if (!searchFocusToken || ghostMode) return
    setSearchPopupOpen(true)
  }, [searchFocusToken, ghostMode])

  const tr = t || ((k) => k)

  const renderSessionGroups = (list, { inPopup = false, onSelect } = {}) => {
    const groups = groupSessionsByDate(list)
    const renderGroup = (label, items) => items.length === 0 ? null : (
      <div key={label} className={inPopup ? styles.popupGroup : undefined}>
        <div className={inPopup ? styles.popupGroupLabel : styles.sessionGroup}>{label}</div>
        {items.map(s => (
          <button
            key={s.id}
            type="button"
            className={`${inPopup ? styles.popupSessionItem : styles.sessionItem} ${s.id === currentSessionId ? (inPopup ? styles.popupSessionActive : styles.active) : ''}`}
            onClick={() => (onSelect ? onSelect(s.id) : onSelectSession(s.id))}
            onMouseEnter={() => !inPopup && setHoveredSession(s.id)}
            onMouseLeave={() => !inPopup && setHoveredSession(null)}
          >
            <span className={inPopup ? styles.popupSessionTitle : styles.sessionTitle}>
              {s.title || tr('newConversation')}
            </span>
            {!inPopup && hoveredSession === s.id && (
              <span
                role="button"
                tabIndex={0}
                className={styles.deleteSessionBtn}
                onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDeleteSession(s.id) } }}
                title="Delete"
              >
                <Trash2 size={12} />
              </span>
            )}
          </button>
        ))}
      </div>
    )
    return (
      <>
        {renderGroup(tr('today'), groups.today)}
        {renderGroup(tr('yesterday'), groups.yesterday)}
        {renderGroup(tr('thisWeek'), groups.week)}
        {renderGroup(tr('older'), groups.older)}
      </>
    )
  }

  const navItems = [
    { id: 'dashboard', label: tr('dashboard'), icon: LayoutDashboard },
    { id: 'mcp-servers', label: tr('mcpServers'), icon: Server, badge: mcpCount || null },
    { id: 'tool-execution', label: tr('toolExecution'), icon: Wrench },
    { id: 'pricing', label: tr('pricing') || 'Pricing', icon: Crown, special: true },
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
          <>
            <div className={styles.brand} onClick={onBrandClick} style={{ cursor: 'pointer' }}>
              <div className={styles.brandIcon}><Bot size={16} /></div>
              <span className={styles.brandName}>ToolChain AI</span>
            </div>
            <button
              type="button"
              className={`${styles.topSearchBtn} ${ghostMode ? styles.topSearchBtnDisabled : ''}`}
              onClick={openSearchPopup}
              disabled={ghostMode}
              title={ghostMode ? (tr('ghostSearchBlocked') || 'Chats hidden in ghost mode') : (tr('searchChats') || 'Search chats')}
              aria-label={tr('searchChats') || 'Search chats'}
            >
              <Search size={17} />
            </button>
          </>
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
            className={`${styles.collapsedBtn} ${ghostMode ? styles.collapsedBtnDisabled : ''}`}
            onClick={openSearchPopup}
            disabled={ghostMode}
            title={ghostMode ? (tr('ghostSearchBlocked') || 'Chats hidden in ghost mode') : (tr('searchChats') || 'Search chats')}
          >
            <Search size={18} />
          </button>

          <button
            className={`${styles.collapsedBtn} ${activePage === 'settings' ? styles.collapsedBtnActive : ''}`}
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
                <div key={item.id} className={isChat && isActive && chatExpanded ? styles.chatNavBlock : undefined}>
                  {isChat ? (
                    <button
                      className={`${styles.navItem} ${styles.navItemCollapsible} ${isActive ? styles.navItemActive : ''}`}
                      onClick={() => {
                        if (activePage !== 'chat') {
                          onNavigate('chat')
                          setChatExpanded(true)
                        } else {
                          setChatExpanded((v) => !v)
                        }
                      }}
                    >
                      <Icon size={17} />
                      <span className={styles.navLabel}>{item.label}</span>
                      <span className={`${styles.collapseArrow} ${chatExpanded && isActive ? styles.collapseArrowOpen : ''}`}>
                        <ChevronRight size={14} />
                      </span>
                    </button>
                  ) : (
                  <button
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''} ${item.special ? styles.navItemSpecial : ''}`}
                    onClick={() => onNavigate(item.id)}
                  >
                    <Icon size={17} />
                    <span className={styles.navLabel}>{item.label}</span>
                    {item.special && user && (
                      <span className={`${styles.navPlanTag} ${styles[`navPlanTag_${user.plan || 'free'}`]}`}>
                        {user.plan === 'enterprise' ? 'Enterprise' : user.plan === 'pro' ? 'Pro' : 'Free'}
                      </span>
                    )}
                    {item.badge != null && <span className={styles.navBadge}>{item.badge}</span>}
                  </button>
                  )}

                  {isChat && isActive && chatExpanded && (
                    <div className={styles.chatSub}>
                      <button
                        type="button"
                        className={styles.newChatBtn}
                        onClick={onNewChat}
                      >
                        <span className={styles.newChatIcon}>
                          <Plus size={15} strokeWidth={2.5} />
                        </span>
                        <span className={styles.newChatLabel}>{tr('newChat') || 'New chat'}</span>
                      </button>

                      <div className={styles.sessions}>
                        {ghostMode ? (
                          <div className={styles.ghostSidebarNotice}>
                            <Ghost size={15} />
                            <span>{tr('ghostSidebarHidden') || 'Chats hidden — ghost mode active'}</span>
                          </div>
                        ) : sessionsLoading ? (
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
                          renderSessionGroups(sessions)
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          <div className={styles.bottom}>
            {user && (!user.plan || user.plan === 'free') && (
              <button className={styles.upgradeBanner} onClick={() => onNavigate('pricing')}>
                <Zap size={13} />
                <span>Upgrade Plan</span>
              </button>
            )}

            <button
              className={`${styles.settingsBtn} ${activePage === 'settings' ? styles.settingsBtnActive : ''}`}
              onClick={onOpenSettings}
            >
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

    {searchPopupOpen && (
      <div
        className={styles.searchOverlay}
        onClick={(e) => { if (e.target === e.currentTarget) closeSearchPopup() }}
      >
        <div className={styles.searchModal} ref={searchPopupRef} role="dialog" aria-modal="true" aria-label={tr('searchChats') || 'Search chats'}>
          <div className={styles.searchModalHeader}>
            <Search size={18} className={styles.searchModalIcon} />
            <input
              ref={searchInputRef}
              className={styles.searchModalInput}
              type="text"
              placeholder={tr('searchChats') || 'Search chats…'}
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
              aria-label={tr('searchChats') || 'Search chats'}
            />
            <button
              type="button"
              className={styles.searchModalClose}
              onClick={closeSearchPopup}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className={styles.searchModalBody}>
            {sessionsLoading ? (
              <div className={styles.searchModalEmpty}>{tr('loading') || 'Loading…'}</div>
            ) : popupSessions.length === 0 ? (
              <div className={styles.searchModalEmpty}>
                {sessionSearch ? (tr('noResults') || 'No results') : tr('noConversations')}
              </div>
            ) : (
              renderSessionGroups(popupSessions, { inPopup: true, onSelect: handlePopupSelectSession })
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
