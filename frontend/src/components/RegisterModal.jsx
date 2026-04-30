import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import styles from './RegisterModal.module.css'

export function RegisterModal({ onClose, onRegister }) {
  const [form, setForm] = useState({ name: '', url: '', transport: 'sse', description: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Server name is required.')
    if (!form.url.trim()) return setError('Server URL is required.')
    if (!/^https?:\/\//i.test(form.url)) return setError('URL must start with http:// or https://')

    setLoading(true)
    try {
      await onRegister({
        name: form.name.trim(),
        url: form.url.trim(),
        transport: form.transport,
        description: form.description.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.icon}>⬡</div>
            <div>
              <div className={styles.title}>Register MCP Server</div>
              <div className={styles.subtitle}>Add a new Model Context Protocol server</div>
            </div>
          </div>
          <button className={styles.close} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>
                Server Name <span className={styles.req}>*</span>
              </label>
              <input
                ref={nameRef}
                className={styles.input}
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. my-tools-server"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Transport</label>
              <select className={styles.select} value={form.transport} onChange={(e) => update('transport', e.target.value)}>
                <option value="sse">SSE (Server-Sent Events)</option>
                <option value="streamable_http">Streamable HTTP</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Server URL <span className={styles.req}>*</span>
            </label>
            <input
              className={styles.input}
              type="text"
              value={form.url}
              onChange={(e) => update('url', e.target.value)}
              placeholder="http://127.0.0.1:9000/sse"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Description <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              className={styles.textarea}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What tools or capabilities does this server provide?"
              rows={3}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.btnSubmit} disabled={loading}>
              {loading ? 'Registering…' : 'Register Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
