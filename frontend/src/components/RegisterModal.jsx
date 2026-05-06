import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import styles from './RegisterModal.module.css'

const DOMAIN_MAP = {
  gmail:'gmail.com',mail:'gmail.com',email:'gmail.com',inbox:'gmail.com',
  github:'github.com',gh:'github.com',youtube:'youtube.com',yt:'youtube.com',
  google:'google.com',gcp:'cloud.google.com',slack:'slack.com',
  discord:'discord.com',notion:'notion.so',spotify:'spotify.com',
  twitter:'x.com',tweet:'x.com',facebook:'facebook.com',fb:'facebook.com',
  meta:'meta.com',instagram:'instagram.com',insta:'instagram.com',ig:'instagram.com',
  whatsapp:'whatsapp.com',wa:'whatsapp.com',telegram:'telegram.org',tg:'telegram.org',
  linkedin:'linkedin.com',reddit:'reddit.com',pinterest:'pinterest.com',
  openai:'openai.com',chatgpt:'openai.com',gpt:'openai.com',
  anthropic:'anthropic.com',claude:'anthropic.com',
  aws:'aws.amazon.com',amazon:'amazon.com',azure:'azure.microsoft.com',
  microsoft:'microsoft.com',vercel:'vercel.com',netlify:'netlify.com',
  heroku:'heroku.com',cloudflare:'cloudflare.com',docker:'docker.com',
  kubernetes:'kubernetes.io',k8s:'kubernetes.io',
  firebase:'firebase.google.com',supabase:'supabase.com',
  mongodb:'mongodb.com',mongo:'mongodb.com',postgres:'postgresql.org',
  postgresql:'postgresql.org',mysql:'mysql.com',redis:'redis.io',
  stripe:'stripe.com',paypal:'paypal.com',shopify:'shopify.com',
  figma:'figma.com',jira:'atlassian.com',trello:'trello.com',
  zoom:'zoom.us',dropbox:'dropbox.com',twilio:'twilio.com',
  linear:'linear.app',python:'python.org',node:'nodejs.org',nodejs:'nodejs.org',
  react:'react.dev',nextjs:'nextjs.org',vue:'vuejs.org',angular:'angular.io',
  svelte:'svelte.dev',tailwind:'tailwindcss.com',typescript:'typescriptlang.org',
  rust:'rust-lang.org',go:'go.dev',php:'php.net',ruby:'ruby-lang.org',
  laravel:'laravel.com',django:'djangoproject.com',flask:'flask.palletsprojects.com',
  wordpress:'wordpress.org',graphql:'graphql.org',prisma:'prisma.io',
  elasticsearch:'elastic.co',jenkins:'jenkins.io',gitlab:'gitlab.com',
  bitbucket:'bitbucket.org',npm:'npmjs.com',deno:'deno.land',
  apple:'apple.com',samsung:'samsung.com',nvidia:'nvidia.com',
  tesla:'tesla.com',uber:'uber.com',airbnb:'airbnb.com',
  netflix:'netflix.com',tiktok:'tiktok.com',snapchat:'snapchat.com',
  twitch:'twitch.tv',steam:'store.steampowered.com',
  adobe:'adobe.com',photoshop:'adobe.com',canva:'canva.com',
  salesforce:'salesforce.com',hubspot:'hubspot.com',
  asana:'asana.com',monday:'monday.com',clickup:'clickup.com',
}

function detectIcon(name) {
  if (!name) return null
  const lower = name.toLowerCase().replace(/[\s_\-.]+/g, '').replace(/mcp|server|tools?|api/g, '')
  if (lower.length < 2) return null

  if (lower.includes('gmail') || lower.includes('mail') || lower.includes('email') || lower.includes('inbox')) {
    return 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico'
  }

  for (const [key, domain] of Object.entries(DOMAIN_MAP)) {
    if (lower.includes(key)) {
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    }
  }
  return `https://www.google.com/s2/favicons?domain=${lower}.com&sz=128`
}

function IconPreview({ src }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  if (!src || failed) return null
  return <img key={src} src={src} alt="" className={styles.iconPreview} onError={() => setFailed(true)} />
}

export function RegisterModal({ onClose, onRegister }) {
  const [form, setForm] = useState({ name: '', url: '', transport: 'sse', description: '', icon: '' })
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
      const iconUrl = form.icon.trim() || detectIcon(form.name.trim()) || null
      await onRegister({
        name: form.name.trim(),
        url: form.url.trim(),
        transport: form.transport,
        description: form.description.trim() || null,
        icon: iconUrl,
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
              Icon URL <span className={styles.optional}>optional — auto-detected for known services</span>
            </label>
            <div className={styles.iconInputWrap}>
              <IconPreview src={form.icon.trim() || detectIcon(form.name)} />
              <input
                className={styles.input}
                type="text"
                value={form.icon}
                onChange={(e) => update('icon', e.target.value)}
                placeholder={detectIcon(form.name) ? 'Auto-detected ✓' : 'https://example.com/icon.png'}
              />
            </div>
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
