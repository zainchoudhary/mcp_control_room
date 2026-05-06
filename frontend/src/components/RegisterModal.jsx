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
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, loading])

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
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Register MCP Server</h2>
            <p className={styles.subtitle}>Add a new Model Context Protocol server</p>
          </div>
          <button className={styles.close} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Server Name</label>
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
                <option value="sse">SSE</option>
                <option value="streamable_http">Streamable HTTP</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Server URL</label>
            <input
              className={styles.input}
              type="text"
              value={form.url}
              onChange={(e) => update('url', e.target.value)}
              placeholder="http://127.0.0.1:9000"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Description <span className={styles.optional}>optional</span>
            </label>
            <textarea
              className={styles.textarea}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What tools does this server provide?"
              rows={3}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className={styles.btnSubmit} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Register Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
