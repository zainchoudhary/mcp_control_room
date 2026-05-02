import { useState, useRef, useEffect } from 'react'
import { Eye, EyeOff, Mail, Lock, User, UserCircle, ArrowRight, Bot, Sparkles, Shield, Zap, Check, X } from 'lucide-react'
import styles from './AuthPage.module.css'

const PASSWORD_RULES = [
  { test: (v) => v.length >= 8, label: '8+ characters', icon: '•' },
  { test: (v) => /[A-Z]/.test(v), label: 'Uppercase', icon: '•' },
  { test: (v) => /[a-z]/.test(v), label: 'Lowercase', icon: '•' },
  { test: (v) => /\d/.test(v), label: 'Number', icon: '•' },
  { test: (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(v), label: 'Special char', icon: '•' },
]

function validateEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
}

function validateUsername(username) {
  if (username.length < 3) return 'Username must be at least 3 characters.'
  if (username.length > 30) return 'Username must not exceed 30 characters.'
  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(username))
    return 'Must start with a letter. Only letters, numbers, dots, hyphens, underscores.'
  return ''
}

export function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirm_password: '', full_name: '',
  })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [touched, setTouched] = useState({})
  const emailRef = useRef(null)
  const usernameRef = useRef(null)

  useEffect(() => {
    if (mode === 'signup') usernameRef.current?.focus()
    else emailRef.current?.focus()
  }, [mode])

  const update = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }))
    setTouched((p) => ({ ...p, [key]: true }))
    setServerError('')
    const newErrors = { ...errors }
    if (key === 'email' && value) newErrors.email = validateEmail(value) ? '' : 'Please enter a valid email address.'
    if (key === 'username' && value) newErrors.username = validateUsername(value)
    if (key === 'password') {
      const failing = PASSWORD_RULES.filter((r) => !r.test(value))
      newErrors.password = failing.length > 0 ? `Missing: ${failing.map((r) => r.label.toLowerCase()).join(', ')}.` : ''
      if (form.confirm_password && value !== form.confirm_password) newErrors.confirm_password = 'Passwords do not match.'
      else newErrors.confirm_password = ''
    }
    if (key === 'confirm_password') newErrors.confirm_password = value !== form.password ? 'Passwords do not match.' : ''
    setErrors(newErrors)
  }

  const blur = (key) => setTouched((p) => ({ ...p, [key]: true }))
  const isSignupValid = () => form.username && form.email && form.password && form.confirm_password && !errors.username && !errors.email && !errors.password && !errors.confirm_password
  const isLoginValid = () => form.email && form.password

  const switchMode = (m) => {
    setMode(m)
    setForm({ username: '', email: '', password: '', confirm_password: '', full_name: '' })
    setErrors({})
    setServerError('')
    setTouched({})
  }

  const submit = async (e) => {
    e.preventDefault()
    setServerError('')
    setLoading(true)
    try {
      const { signup, login } = await import('../auth.js')
      if (mode === 'signup') {
        const data = await signup({ username: form.username.trim(), email: form.email.trim(), password: form.password, confirm_password: form.confirm_password, full_name: form.full_name.trim() || null })
        onAuth(data.user, data.access_token)
      } else {
        const data = await login({ email: form.email.trim(), password: form.password })
        onAuth(data.user, data.access_token)
      }
    } catch (err) { setServerError(err.message) } finally { setLoading(false) }
  }

  const passStrength = (() => {
    const passed = PASSWORD_RULES.filter((r) => r.test(form.password)).length
    if (passed <= 1) return { level: 0, label: '', color: '' }
    if (passed <= 2) return { level: 1, label: 'Weak', color: '#ef4444' }
    if (passed <= 3) return { level: 2, label: 'Fair', color: '#f59e0b' }
    if (passed <= 4) return { level: 3, label: 'Good', color: '#3b82f6' }
    return { level: 4, label: 'Strong', color: '#10a37f' }
  })()

  return (
    <div className={styles.page}>
      <div className={styles.heroSide}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <Sparkles size={14} />
            <span>AI-Powered Platform</span>
          </div>
          <h1 className={styles.heroTitle}>ToolChain AI</h1>
          <p className={styles.heroDesc}>
            Connect MCP servers and chat with an intelligent agent that uses their tools seamlessly.
          </p>
          <div className={styles.heroFeatures}>
            <div className={styles.heroFeature}>
              <div className={styles.featureIcon}><Zap size={18} /></div>
              <div>
                <div className={styles.featureTitle}>Lightning Fast</div>
                <div className={styles.featureDesc}>Real-time streaming responses</div>
              </div>
            </div>
            <div className={styles.heroFeature}>
              <div className={styles.featureIcon}><Shield size={18} /></div>
              <div>
                <div className={styles.featureTitle}>Secure</div>
                <div className={styles.featureDesc}>Enterprise-grade encryption</div>
              </div>
            </div>
            <div className={styles.heroFeature}>
              <div className={styles.featureIcon}><Bot size={18} /></div>
              <div>
                <div className={styles.featureTitle}>Smart Agent</div>
                <div className={styles.featureDesc}>Multi-tool AI orchestration</div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.heroOrbs}>
          <div className={styles.orb1} />
          <div className={styles.orb2} />
          <div className={styles.orb3} />
        </div>
      </div>

      <div className={styles.formSide}>
        <div className={styles.formScroll}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.logoMobile}>
                <div className={styles.logoIcon}><Bot size={20} /></div>
                <span>ToolChain AI</span>
              </div>
              <h2 className={styles.cardTitle}>
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className={styles.cardSubtitle}>
                {mode === 'login' ? 'Enter your credentials to continue' : 'Get started for free'}
              </p>
            </div>

            <div className={styles.tabs}>
              <button className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`} onClick={() => switchMode('login')} type="button">Sign In</button>
              <button className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`} onClick={() => switchMode('signup')} type="button">Sign Up</button>
              <div className={styles.tabIndicator} style={{ transform: mode === 'signup' ? 'translateX(100%)' : 'translateX(0)' }} />
            </div>

            <form onSubmit={submit} className={styles.form} noValidate>
              {mode === 'signup' && (
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}>Username</label>
                    <div className={styles.inputWrap}>
                      <User size={15} className={styles.inputIcon} />
                      <input ref={usernameRef} className={`${styles.input} ${touched.username && errors.username ? styles.inputError : ''} ${touched.username && !errors.username && form.username ? styles.inputSuccess : ''}`} type="text" value={form.username} onChange={(e) => update('username', e.target.value)} onBlur={() => blur('username')} placeholder="johndoe" autoComplete="username" />
                      {touched.username && form.username && (
                        <span className={`${styles.inputStatus} ${errors.username ? styles.statusError : styles.statusOk}`}>
                          {errors.username ? <X size={13} /> : <Check size={13} />}
                        </span>
                      )}
                    </div>
                    {touched.username && errors.username && <span className={styles.error}>{errors.username}</span>}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Full Name <span className={styles.optional}>optional</span></label>
                    <div className={styles.inputWrap}>
                      <UserCircle size={15} className={styles.inputIcon} />
                      <input className={styles.input} type="text" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="John Doe" autoComplete="name" />
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>Email address</label>
                <div className={styles.inputWrap}>
                  <Mail size={15} className={styles.inputIcon} />
                  <input ref={mode === 'login' ? emailRef : null} className={`${styles.input} ${touched.email && errors.email ? styles.inputError : ''} ${touched.email && !errors.email && form.email ? styles.inputSuccess : ''}`} type="email" value={form.email} onChange={(e) => update('email', e.target.value)} onBlur={() => blur('email')} placeholder="you@example.com" autoComplete="email" />
                  {touched.email && form.email && (
                    <span className={`${styles.inputStatus} ${errors.email ? styles.statusError : styles.statusOk}`}>
                      {errors.email ? <X size={13} /> : <Check size={13} />}
                    </span>
                  )}
                </div>
                {touched.email && errors.email && <span className={styles.error}>{errors.email}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Password</label>
                <div className={styles.inputWrap}>
                  <Lock size={15} className={styles.inputIcon} />
                  <input className={`${styles.input} ${touched.password && errors.password && mode === 'signup' ? styles.inputError : ''}`} type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} onBlur={() => blur('password')} placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword((p) => !p)} tabIndex={-1}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {mode === 'signup' && form.password && (
                  <div className={styles.strengthArea}>
                    <div className={styles.strengthBar}>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={styles.strengthSeg} style={{ background: i <= passStrength.level ? passStrength.color : 'var(--border-default)', transform: i <= passStrength.level ? 'scaleY(1)' : 'scaleY(0.6)' }} />
                      ))}
                    </div>
                    {passStrength.label && <span className={styles.strengthLabel} style={{ color: passStrength.color }}>{passStrength.label}</span>}
                  </div>
                )}
                {mode === 'signup' && form.password && (
                  <div className={styles.rulesList}>
                    {PASSWORD_RULES.map((r, i) => {
                      const ok = r.test(form.password)
                      return (
                        <span key={i} className={`${styles.rule} ${ok ? styles.ruleOk : ''}`}>
                          {ok ? <Check size={10} /> : <X size={10} />}
                          {r.label}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              {mode === 'signup' && (
                <div className={styles.field}>
                  <label className={styles.label}>Confirm password</label>
                  <div className={styles.inputWrap}>
                    <Lock size={15} className={styles.inputIcon} />
                    <input className={`${styles.input} ${touched.confirm_password && errors.confirm_password ? styles.inputError : ''} ${touched.confirm_password && !errors.confirm_password && form.confirm_password ? styles.inputSuccess : ''}`} type={showConfirm ? 'text' : 'password'} value={form.confirm_password} onChange={(e) => update('confirm_password', e.target.value)} onBlur={() => blur('confirm_password')} placeholder="••••••••" autoComplete="new-password" />
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm((p) => !p)} tabIndex={-1}>
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {touched.confirm_password && errors.confirm_password && <span className={styles.error}>{errors.confirm_password}</span>}
                </div>
              )}

              {serverError && <div className={styles.serverError}>{serverError}</div>}

              <button type="submit" className={styles.submitBtn} disabled={loading || (mode === 'signup' ? !isSignupValid() : !isLoginValid())}>
                {loading ? <span className={styles.spinner} /> : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className={styles.divider}><span>or</span></div>

            <p className={styles.switchText}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" className={styles.switchLink} onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
