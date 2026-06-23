import { useMemo, useState } from 'react'
import { Search, X, Plus, Trash2, Check, Loader2 } from 'lucide-react'
import styles from './AllChatsPage.module.css'

function formatChatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`

  const opts = { month: 'short', day: 'numeric' }
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString('en-US', opts)
}

export function AllChatsPage({
  sessions,
  sessionsLoading,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSessions,
  t,
}) {
  const [search, setSearch] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleting, setDeleting] = useState(false)

  const tr = (key, fallback) => t?.(key) || fallback

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter((s) => (s.title || '').toLowerCase().includes(q))
  }, [sessions, search])

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const handleSelectModeToggle = () => {
    if (selectMode) exitSelectMode()
    else setSelectMode(true)
  }

  const handleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((s) => s.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (selected.size === 0 || deleting) return
    const ids = [...selected]
    setDeleting(true)
    try {
      const deleted = await onDeleteSessions(ids)
      if (deleted) exitSelectMode()
    } finally {
      setDeleting(false)
    }
  }

  const handleRowClick = (id) => {
    if (selectMode) {
      toggleSelect(id)
      return
    }
    onSelectSession(id)
  }

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <div className={styles.header}>
          <h1 className={styles.title}>{tr('chats', 'Chats')}</h1>
          <div className={styles.headerActions}>
            {selectMode && selected.size > 0 && (
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={handleDeleteSelected}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={15} className={styles.spin} /> : <Trash2 size={15} />}
                <span>{tr('deleteSelected', 'Delete')} ({selected.size})</span>
              </button>
            )}
            <button
              type="button"
              className={`${styles.selectBtn} ${selectMode ? styles.selectBtnActive : ''}`}
              onClick={handleSelectModeToggle}
              disabled={sessionsLoading || sessions.length === 0}
            >
              {selectMode ? tr('cancel', 'Cancel') : tr('selectChats', 'Select chats')}
            </button>
            <button type="button" className={styles.newChatBtn} onClick={onNewChat}>
              <Plus size={16} />
              <span>{tr('newChat', 'New chat')}</span>
            </button>
          </div>
        </div>

        <div className={styles.searchBar}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={tr('searchChats', 'Search chats...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {selectMode && filtered.length > 0 && (
          <div className={styles.selectBar}>
            <button type="button" className={styles.selectAllBtn} onClick={handleSelectAll}>
              {selected.size === filtered.length ? tr('deselectAll', 'Deselect all') : tr('selectAll', 'Select all')}
            </button>
            <span className={styles.selectCount}>
              {selected.size} {tr('selected', 'selected')}
            </span>
          </div>
        )}
      </div>

      <div className={styles.listScroll}>
        <div className={styles.list}>
        {sessionsLoading ? (
          <div className={styles.loading}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={styles.skelRow} style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            {search.trim()
              ? tr('noChatsFound', 'No chats match your search.')
              : tr('noConversations', 'No conversations yet')}
          </div>
        ) : (
          filtered.map((session) => {
            const isSelected = selected.has(session.id)
            const isActive = session.id === currentSessionId
            return (
              <button
                key={session.id}
                type="button"
                className={`${styles.chatRow} ${isActive ? styles.chatRowActive : ''} ${isSelected ? styles.chatRowSelected : ''}`}
                onClick={() => handleRowClick(session.id)}
              >
                {selectMode && (
                  <span className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </span>
                )}
                <span className={styles.chatTitle}>
                  {session.title || tr('newConversation', 'New conversation')}
                </span>
                <span className={styles.chatDate}>{formatChatDate(session.created_at)}</span>
              </button>
            )
          })
        )}
        </div>
      </div>
    </div>
  )
}
