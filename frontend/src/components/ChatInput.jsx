import { useRef, useEffect, useCallback, useState } from 'react'
import { ArrowUp, Loader2, Plus, Server } from 'lucide-react'
import styles from './ChatInput.module.css'

export function ChatInput({
  value,
  onChange,
  onSend,
  sending,
  connectedCount,
  onOpenRegister,
}) {
  const textareaRef = useRef(null)
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

  useEffect(() => { autoResize() }, [value, autoResize])
  useEffect(() => { textareaRef.current?.focus() }, [])

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const canSend = value.trim() && !sending

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={styles.inputArea}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message ToolChain AI..."
            className={styles.textarea}
            rows={1}
            disabled={sending}
          />
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft} ref={menuRef}>
            <button
              type="button"
              className={`${styles.plusBtn} ${menuOpen ? styles.plusBtnActive : ''}`}
              onClick={() => setMenuOpen((v) => !v)}
              title="Options"
            >
              <Plus size={18} />
            </button>

            {menuOpen && (
              <div className={styles.plusMenu}>
                <button
                  className={styles.plusMenuItem}
                  onClick={() => { setMenuOpen(false); onOpenRegister() }}
                >
                  <div className={styles.plusMenuIcon}><Server size={15} /></div>
                  <div className={styles.plusMenuText}>
                    <span className={styles.plusMenuTitle}>Register MCP Server</span>
                    <span className={styles.plusMenuHint}>Add a new MCP server</span>
                  </div>
                </button>
              </div>
            )}

            {connectedCount > 0 && (
              <span className={styles.connectedBadge}>
                <span className={styles.connectedDot} />
                {connectedCount} MCP{connectedCount !== 1 ? 's' : ''} connected
              </span>
            )}
          </div>

          <button
            className={`${styles.sendBtn} ${canSend ? styles.sendActive : ''}`}
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
          >
            {sending ? <Loader2 size={18} className={styles.spinner} /> : <ArrowUp size={18} />}
          </button>
        </div>
      </div>
      <p className={styles.disclaimer}>
        ToolChain AI can make mistakes. Verify important information.
      </p>
    </div>
  )
}
