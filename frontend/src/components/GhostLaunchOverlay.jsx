import { useEffect, useState } from 'react'
import { Ghost, Rocket } from 'lucide-react'
import styles from './GhostLaunchOverlay.module.css'

export function GhostLaunchOverlay({ active, onComplete }) {
  const [phase, setPhase] = useState('idle')

  useEffect(() => {
    if (!active) {
      setPhase('idle')
      return
    }
    setPhase('launch')
    const t1 = setTimeout(() => setPhase('warp'), 1400)
    const t2 = setTimeout(() => {
      setPhase('done')
      onComplete?.()
    }, 2600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [active, onComplete])

  if (!active && phase === 'idle') return null
  if (phase === 'done') return null

  return (
    <div className={`${styles.overlay} ${phase === 'warp' ? styles.warp : ''}`} aria-hidden>
      <div className={styles.stars} />
      <div className={styles.stars2} />

      <div className={styles.shipWrap}>
        <div className={styles.engineGlow} />
        <div className={styles.ship}>
          <Rocket size={42} strokeWidth={1.5} />
        </div>
        <div className={styles.trail} />
        <div className={styles.trail2} />
      </div>

      <div className={styles.content}>
        <div className={styles.ghostBadge}>
          <Ghost size={28} />
        </div>
        <h2 className={styles.title}>Entering Ghost Mode</h2>
        <p className={styles.subtitle}>
          {phase === 'launch' ? 'Launching anonymous channel…' : 'Warp engaged — no traces left behind'}
        </p>
        <div className={styles.progress}>
          <div className={styles.progressBar} />
        </div>
      </div>
    </div>
  )
}
