import { useEffect, useRef } from 'react'
import { AlertTriangle, Trash2, LogOut } from 'lucide-react'
import styles from './ConfirmDialog.module.css'

const ICONS = {
  delete: Trash2,
  logout: LogOut,
  warning: AlertTriangle,
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  icon = 'warning',
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

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current && !loading) onCancel() }}
    >
      <div className={styles.dialog}>
        <div className={`${styles.iconWrap} ${styles[variant]}`}>
          <Icon size={24} />
        </div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className={`${styles.confirmBtn} ${styles[`confirm_${variant}`]}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className={styles.spinner} /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
