import { useEffect, useRef } from 'react'
import { Trash2, LogOut, AlertTriangle, Unplug } from 'lucide-react'
import styles from './ConfirmDialog.module.css'

const ICONS = {
  delete: Trash2,
  logout: LogOut,
  warning: AlertTriangle,
  disconnect: Unplug,
}

/** 'pageFlip' = book page turn (default); 'default' = simple drop */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  icon = 'warning',
  animation = 'pageFlip',
  onConfirm,
  onCancel,
  loading = false,
}) {
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleEsc = (e) => { if (e.key === 'Escape' && !loading) onCancel() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onCancel, loading])

  if (!open) return null

  const Icon = ICONS[icon] || AlertTriangle
  const isPageFlip = animation === 'pageFlip'

  return (
    <div
      className={`${styles.overlay} ${isPageFlip ? styles.overlayFlip : ''}`}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current && !loading) onCancel() }}
    >
      <div className={isPageFlip ? styles.flipStage : undefined}>
        <div
          className={`${styles.modal} ${isPageFlip ? styles.modalPageFlip : styles.modalDefault} ${styles[`modal_${variant}`]}`}
          key={`${title}-${animation}`}
        >
          <div className={styles.body}>
            <div className={`${styles.badge} ${styles[`badge_${variant}`]}`}>
              <Icon size={20} strokeWidth={2.5} />
            </div>

            <div className={styles.text}>
              <h2 className={styles.title}>{title}</h2>
              <p className={styles.msg}>{message}</p>
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.btn} ${styles[`btn_${variant}`]}`}
                onClick={onConfirm}
                disabled={loading}
              >
                {loading ? <span className={styles.spin} /> : confirmLabel}
              </button>
              <button className={styles.btnGhost} onClick={onCancel} disabled={loading}>
                {cancelLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
