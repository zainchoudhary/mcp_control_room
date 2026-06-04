import { useRef, useEffect, useCallback, useState } from 'react'
import { ArrowUp, Loader2, Plus, Server, Plug, ChevronRight, Paperclip, ImageIcon, FileText } from 'lucide-react'
import { FileAttachmentCard } from './FileAttachmentCard.jsx'
import styles from './ChatInput.module.css'

export function ChatInput({
  value,
  onChange,
  onSend,
  sending,
  connectedCount,
  onOpenRegister,
  mcps,
  enabledIds,
  onToggle,
  attachments = [],
  pendingUploads = [],
  onAddFiles,
  onRemoveAttachment,
  uploadingFiles = false,
  t: _t,
}) {
  const t = _t || ((k) => k)
  const textareaRef = useRef(null)
  const wrapperRef = useRef(null)
  const attachRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showConnectors, setShowConnectors] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)

  const FILE_ACCEPT =
    '.pdf,.docx,.xlsx,.txt,.md,.csv,.json,.xml,.html,.py,.js,.ts,.jsx,.tsx,.css,.yaml,.yml,.java,.c,.cpp,.go,.rs,.sql,.log'

  const composerItems = [
    ...pendingUploads.map((p) => ({ ...p, uploading: true })),
    ...attachments.map((a) => ({ ...a, uploading: false })),
  ]
  const hasComposerFiles = composerItems.length > 0

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

  useEffect(() => { autoResize() }, [value, autoResize])
  useEffect(() => { textareaRef.current?.focus() }, [])

  useEffect(() => {
    if (!menuOpen && !attachMenuOpen) return
    const handleClick = (e) => {
      if (menuOpen && wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMenuOpen(false)
        setShowConnectors(false)
      }
      if (attachMenuOpen && attachRef.current && !attachRef.current.contains(e.target)) {
        setAttachMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [menuOpen, attachMenuOpen])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const toggleMenu = () => {
    setAttachMenuOpen(false)
    setMenuOpen((v) => {
      if (v) setShowConnectors(false)
      return !v
    })
  }

  const canSend =
    (value.trim() || attachments.length > 0) &&
    !sending &&
    !uploadingFiles &&
    pendingUploads.length === 0

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length && onAddFiles) onAddFiles(files)
    e.target.value = ''
    setAttachMenuOpen(false)
  }

  const toggleAttachMenu = () => {
    setAttachMenuOpen((v) => !v)
    setMenuOpen(false)
    setShowConnectors(false)
  }

  const openFilePicker = (mode) => {
    setAttachMenuOpen(false)
    if (mode === 'image') {
      imageInputRef.current?.click()
    } else {
      fileInputRef.current?.click()
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.container} ${hasComposerFiles ? styles.containerWithFiles : ''}`}>
        <div className={styles.inputArea}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('typeMessage')}
            className={styles.textarea}
            rows={1}
            disabled={sending}
          />

          {hasComposerFiles && (
            <div className={styles.attachmentsRow}>
              {composerItems.map((item) => (
                <FileAttachmentCard
                  key={item.tempId || item.id}
                  name={item.name}
                  kind={item.kind}
                  previewUrl={item.previewUrl}
                  uploading={item.uploading}
                  variant="composer"
                  disabled={sending || item.uploading}
                  onRemove={
                    item.uploading
                      ? undefined
                      : () => onRemoveAttachment?.(item.tempId || item.id)
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft} ref={wrapperRef}>
            <button
              type="button"
              className={`${styles.plusBtn} ${menuOpen ? styles.plusBtnActive : ''}`}
              onClick={toggleMenu}
              title="Options"
            >
              <Plus size={18} />
              {connectedCount > 0 && (
                <span className={styles.badge}>{connectedCount}</span>
              )}
            </button>

            <div className={styles.attachWrap} ref={attachRef}>
              <input
                ref={imageInputRef}
                type="file"
                className={styles.hiddenFileInput}
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
              />
              <input
                ref={fileInputRef}
                type="file"
                className={styles.hiddenFileInput}
                multiple
                accept={FILE_ACCEPT}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className={`${styles.attachBtn} ${attachMenuOpen ? styles.attachBtnActive : ''}`}
                onClick={toggleAttachMenu}
                title="Attach"
                disabled={sending}
                aria-expanded={attachMenuOpen}
              >
                <Paperclip size={17} />
              </button>

              {attachMenuOpen && (
                <div className={styles.attachMenuFloat}>
                  <div className={styles.plusMenu}>
                    <button
                      type="button"
                      className={styles.plusMenuItem}
                      onClick={() => openFilePicker('file')}
                    >
                      <div className={styles.plusMenuIcon}><FileText size={15} /></div>
                      <div className={styles.plusMenuText}>
                        <span className={styles.plusMenuTitle}>Attach file</span>
                        <span className={styles.plusMenuHint}>PDF, Word, Excel, text, code</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={styles.plusMenuItem}
                      onClick={() => openFilePicker('image')}
                    >
                      <div className={styles.plusMenuIcon}><ImageIcon size={15} /></div>
                      <div className={styles.plusMenuText}>
                        <span className={styles.plusMenuTitle}>Attach photo</span>
                        <span className={styles.plusMenuHint}>JPG, PNG, GIF, WebP</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {menuOpen && (
              <div className={styles.floatingGroup}>
                <div className={styles.plusMenu}>
                  <button
                    className={`${styles.plusMenuItem} ${showConnectors ? styles.plusMenuItemActive : ''}`}
                    onClick={() => setShowConnectors((v) => !v)}
                  >
                    <div className={styles.plusMenuIcon}><Plug size={15} /></div>
                    <div className={styles.plusMenuText}>
                      <span className={styles.plusMenuTitle}>Connectors</span>
                      <span className={styles.plusMenuHint}>
                        {mcps.length === 0 ? 'No servers connected' : `${connectedCount} of ${mcps.length} enabled`}
                      </span>
                    </div>
                    <ChevronRight size={15} className={`${styles.plusMenuArrow} ${showConnectors ? styles.arrowRotated : ''}`} />
                  </button>
                  <button
                    className={styles.plusMenuItem}
                    onClick={() => { setMenuOpen(false); setShowConnectors(false); onOpenRegister() }}
                  >
                    <div className={styles.plusMenuIcon}><Server size={15} /></div>
                    <div className={styles.plusMenuText}>
                      <span className={styles.plusMenuTitle}>Register Server</span>
                      <span className={styles.plusMenuHint}>Add a new MCP server</span>
                    </div>
                  </button>
                </div>

                {showConnectors && (
                  <div className={styles.connPanel}>
                    <div className={styles.connPanelBody}>
                      {mcps.length === 0 ? (
                        <div className={styles.connPanelEmpty}>
                          <div className={styles.emptyIcon}><Plug size={22} /></div>
                          <p>No servers connected</p>
                          <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 4 }}>Connect servers from the MCP Servers page</p>
                        </div>
                      ) : (
                        mcps.map((mcp) => (
                          <ConnectorRow
                            key={mcp.id}
                            mcp={mcp}
                            enabled={enabledIds.has(mcp.id)}
                            onToggle={onToggle}
                          />
                        ))
                      )}
                    </div>
                    {mcps.length > 0 && (
                      <div className={styles.connPanelFooter}>
                        {connectedCount} of {mcps.length} enabled
                      </div>
                    )}
                  </div>
                )}
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

function ConnectorRow({ mcp, enabled, onToggle }) {
  return (
    <div className={styles.connRow}>
      <div className={styles.connInfo}>
        <div className={styles.connIconWrap}>
          {mcp.icon ? (
            <img src={mcp.icon} alt="" className={styles.connIcon} onError={(e) => { e.target.style.display = 'none' }} />
          ) : (
            <Server size={14} className={styles.connIconFallback} />
          )}
          <div className={`${styles.connDot} ${enabled ? styles.connDotOn : ''}`} />
        </div>
        <div className={styles.connDetails}>
          <span className={styles.connName}>{mcp.name}</span>
        </div>
      </div>
      <button
        className={`${styles.switchTrack} ${enabled ? styles.switchOn : ''}`}
        onClick={() => onToggle(mcp.id)}
        aria-label={enabled ? 'Disable' : 'Enable'}
      >
        <span className={styles.switchThumb} />
      </button>
    </div>
  )
}
