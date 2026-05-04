import { useRef, useEffect } from 'react'
import { X, Settings, Sun, Moon, Monitor, Check } from 'lucide-react'
import styles from './SettingsModal.module.css'

export function SettingsModal({ theme, onToggleTheme, onClose }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleOverlay = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  const themes = [
    { id: 'light', label: 'Light', icon: Sun, desc: 'Clean and bright interface' },
    { id: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
  ]

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <Settings size={18} />
            </div>
            <div>
              <h2 className={styles.title}>Settings</h2>
              <p className={styles.subtitle}>Customize your experience</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Appearance</span>
              <span className={styles.sectionHint}>Choose your preferred theme</span>
            </div>

            <div className={styles.themeGrid}>
              {themes.map((t) => {
                const Icon = t.icon
                const isActive = theme === t.id
                return (
                  <button
                    key={t.id}
                    className={`${styles.themeCard} ${isActive ? styles.themeCardActive : ''}`}
                    onClick={() => { if (theme !== t.id) onToggleTheme() }}
                  >
                    <div className={`${styles.themePreview} ${styles[`preview_${t.id}`]}`}>
                      <div className={styles.previewBar} />
                      <div className={styles.previewContent}>
                        <div className={styles.previewLine1} />
                        <div className={styles.previewLine2} />
                        <div className={styles.previewLine3} />
                      </div>
                    </div>
                    <div className={styles.themeInfo}>
                      <div className={styles.themeLabelRow}>
                        <Icon size={14} />
                        <span className={styles.themeLabel}>{t.label}</span>
                        {isActive && <Check size={14} className={styles.themeCheck} />}
                      </div>
                      <span className={styles.themeDesc}>{t.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
