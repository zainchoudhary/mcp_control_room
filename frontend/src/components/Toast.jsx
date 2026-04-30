import { Check, X, Info } from 'lucide-react'
import styles from './Toast.module.css'

const icons = {
  success: Check,
  error: X,
  info: Info,
}

export function ToastContainer({ toasts, dismiss }) {
  return (
    <div className={styles.container}>
      {toasts.map((t) => {
        const Icon = icons[t.type] || Info
        return (
          <div key={t.id} className={`${styles.toast} ${styles[t.type]}`} onClick={() => dismiss(t.id)}>
            <div className={styles.icon}>
              <Icon size={14} />
            </div>
            <span className={styles.text}>{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}
