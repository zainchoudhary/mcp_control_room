import { Brain, Wrench, ShieldCheck, Loader2, Check } from 'lucide-react'
import styles from './ControlRoomPhases.module.css'

const ROLE_META = {
  planner: { label: 'Planner', Icon: Brain },
  tool_runner: { label: 'Tool Runner', Icon: Wrench },
  reviewer: { label: 'Reviewer', Icon: ShieldCheck },
}

function latestByRole(phases) {
  const map = {}
  for (const p of phases) {
    map[p.role] = p
  }
  return ['planner', 'tool_runner', 'reviewer']
    .map((role) => map[role])
    .filter(Boolean)
}

export function ControlRoomPhases({ phases }) {
  const items = latestByRole(phases)
  if (!items.length) return null

  return (
    <div className={styles.row} aria-label="Control Room agents">
      {items.map((p) => {
        const meta = ROLE_META[p.role] || { label: p.role, Icon: Brain }
        const Icon = meta.Icon
        const active = p.status === 'active'
        const done = p.status === 'done'
        return (
          <div
            key={p.role}
            className={`${styles.chip} ${active ? styles.chipActive : ''} ${done ? styles.chipDone : ''}`}
          >
            <Icon size={14} className={styles.chipIcon} />
            <span className={styles.chipLabel}>{meta.label}</span>
            {active && <Loader2 size={12} className={styles.spinner} />}
            {done && !active && <Check size={12} className={styles.check} />}
            {p.detail && (
              <span className={styles.chipDetail} title={p.detail}>
                {p.detail}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function collectPhasesFromParts(parts) {
  return (parts || []).filter((p) => p.type === 'phase')
}
