import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { X as XIcon, Settings, Sun, Moon, Check, User, Eye, EyeOff, ChevronRight, KeyRound, AtSign, Palette, UserCircle, Mail, Calendar, Loader2, Shield, MessageSquare, Download, Trash2, AlertTriangle, Globe, Droplets, CreditCard, Crown, Zap, Building2, ExternalLink, Rocket, Server, Layers } from 'lucide-react'
import { changePassword as apiChangePassword, changeUsername as apiChangeUsername, deleteAllSessions, exportAllChats, deleteAccount as apiDeleteAccount, getSubscription, createPortalSession, getUsage } from '../api.js'
import { LANGUAGES, useLanguage } from '../hooks/useLanguage.js'
import { ACCENT_COLORS } from '../hooks/useAccentColor.js'
import styles from './SettingsModal.module.css'

const PASSWORD_RULES = [
  { test: (v) => v.length >= 8, label: '8+ characters' },
  { test: (v) => /[A-Z]/.test(v), label: 'Uppercase' },
  { test: (v) => /[a-z]/.test(v), label: 'Lowercase' },
  { test: (v) => /\d/.test(v), label: 'Number' },
  { test: (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(v), label: 'Special char' },
]

function GeneralTab({ theme, onToggleTheme, busy, language, onLanguageChange, accentId, onAccentChange, t }) {
  const [openPanel, setOpenPanel] = useState(null)

  const togglePanel = useCallback((panel) => {
    setOpenPanel((prev) => prev === panel ? null : panel)
  }, [])

  const themes = [
    { id: 'light', label: t('lightTheme'), icon: Sun, desc: t('lightDesc') },
    { id: 'dark', label: t('darkTheme'), icon: Moon, desc: t('darkDesc') },
  ]

  const currentLabel = theme === 'dark' ? t('darkTheme') : t('lightTheme')
  const currentLang = LANGUAGES.find((l) => l.id === language)
  const currentAccent = ACCENT_COLORS.find((c) => c.id === accentId) || ACCENT_COLORS[0]

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{t('general')}</span>
        <span className={styles.sectionHint}>{t('customize')}</span>
      </div>

      {/* Appearance */}
      <div className={styles.optionBlock}>
        <button
          className={`${styles.optionRow} ${openPanel === 'appearance' ? styles.optionRowActive : ''}`}
          onClick={() => togglePanel('appearance')}
          disabled={busy}
        >
          <div className={styles.optionIcon}><Palette size={16} /></div>
          <div className={styles.optionText}>
            <span className={styles.optionLabel}>{t('appearance')}</span>
            <span className={styles.optionHint}>{currentLabel}</span>
          </div>
          <ChevronRight size={16} className={`${styles.optionChevron} ${openPanel === 'appearance' ? styles.optionChevronOpen : ''}`} />
        </button>

        {openPanel === 'appearance' && (
          <div className={styles.optionPanel}>
            <div className={styles.themeGrid} style={{ marginTop: 16 }}>
              {themes.map((th) => {
                const Icon = th.icon
                const isActive = theme === th.id
                return (
                  <button
                    key={th.id}
                    className={`${styles.themeCard} ${isActive ? styles.themeCardActive : ''}`}
                    onClick={() => { if (theme !== th.id) onToggleTheme() }}
                    disabled={busy}
                  >
                    <div className={`${styles.themePreview} ${styles[`preview_${th.id}`]}`}>
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
                        <span className={styles.themeLabel}>{th.label}</span>
                        {isActive && <Check size={14} className={styles.themeCheck} />}
                      </div>
                      <span className={styles.themeDesc}>{th.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Language */}
      <div className={styles.optionBlock}>
        <button
          className={`${styles.optionRow} ${openPanel === 'language' ? styles.optionRowActive : ''}`}
          onClick={() => togglePanel('language')}
          disabled={busy}
        >
          <div className={styles.optionIcon}><Globe size={16} /></div>
          <div className={styles.optionText}>
            <span className={styles.optionLabel}>{t('language')}</span>
            <span className={styles.optionHint}>{currentLang?.flag} {currentLang?.label}</span>
          </div>
          <ChevronRight size={16} className={`${styles.optionChevron} ${openPanel === 'language' ? styles.optionChevronOpen : ''}`} />
        </button>

        {openPanel === 'language' && (
          <div className={styles.optionPanel}>
            <div className={styles.langGrid}>
              {LANGUAGES.map((lang) => {
                const isActive = language === lang.id
                return (
                  <button
                    key={lang.id}
                    className={`${styles.langBtn} ${isActive ? styles.langBtnActive : ''}`}
                    onClick={() => onLanguageChange(lang.id)}
                    disabled={busy}
                  >
                    <span className={styles.langFlag}>{lang.flag}</span>
                    <span className={styles.langLabel}>{lang.label}</span>
                    {isActive && <Check size={12} className={styles.langCheck} />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Accent Color */}
      <div className={styles.optionBlock}>
        <button
          className={`${styles.optionRow} ${openPanel === 'accent' ? styles.optionRowActive : ''}`}
          onClick={() => togglePanel('accent')}
          disabled={busy}
        >
          <div className={styles.optionIcon}><Droplets size={16} /></div>
          <div className={styles.optionText}>
            <span className={styles.optionLabel}>{t('accentColor')}</span>
            <span className={styles.optionHint}>
              <span className={styles.accentDotInline} style={{ background: currentAccent.hex }} />
              {currentAccent.id === 'default' ? t('defaultColor') : currentAccent.label}
            </span>
          </div>
          <ChevronRight size={16} className={`${styles.optionChevron} ${openPanel === 'accent' ? styles.optionChevronOpen : ''}`} />
        </button>

        {openPanel === 'accent' && (
          <div className={styles.optionPanel}>
            <div className={styles.accentGrid}>
              {ACCENT_COLORS.map((color) => {
                const isActive = accentId === color.id
                return (
                  <button
                    key={color.id}
                    className={`${styles.accentBtn} ${isActive ? styles.accentBtnActive : ''}`}
                    onClick={() => onAccentChange(color.id)}
                    disabled={busy}
                    title={color.id === 'default' ? t('defaultColor') : color.label}
                  >
                    <span className={styles.accentDot} style={{ background: color.hex }} />
                    {isActive && <Check size={10} className={styles.accentCheck} />}
                    <span className={styles.accentLabel}>{color.id === 'default' ? t('defaultColor') : color.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AccountTab({ user, onLogout, busy, onBusyChange }) {
  const [openPanel, setOpenPanel] = useState(null)
  const [deletePw, setDeletePw] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteMsg, setDeleteMsg] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeletePw, setShowDeletePw] = useState(false)

  const canDelete = deletePw.trim() && deleteConfirm === 'DELETE'

  const handleDeleteAccount = async () => {
    if (!deletePw.trim()) { setDeleteMsg('Please enter your password.'); return }
    if (deleteConfirm !== 'DELETE') { setDeleteMsg('Please type DELETE to confirm.'); return }
    setDeleting(true); setDeleteMsg(null); onBusyChange?.(true)
    try {
      await apiDeleteAccount(deletePw)
      setDeleteMsg(null)
      onLogout?.()
    } catch (err) {
      setDeleteMsg(err.message || 'Failed to delete account.')
    } finally { setDeleting(false); onBusyChange?.(false) }
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Account</span>
        <span className={styles.sectionHint}>Your profile information</span>
      </div>

      <div className={styles.optionBlock}>
        <button
          className={`${styles.optionRow} ${openPanel === 'info' ? styles.optionRowActive : ''}`}
          onClick={() => setOpenPanel(openPanel === 'info' ? null : 'info')}
        >
          <div className={styles.optionIcon}><UserCircle size={16} /></div>
          <div className={styles.optionText}>
            <span className={styles.optionLabel}>Personal Information</span>
            <span className={styles.optionHint}>{user?.full_name || user?.username || 'View your details'}</span>
          </div>
          <ChevronRight size={16} className={`${styles.optionChevron} ${openPanel === 'info' ? styles.optionChevronOpen : ''}`} />
        </button>

        {openPanel === 'info' && (
          <div className={styles.optionPanel}>
            <div className={styles.profileCard}>
              <div className={styles.profileDetails}>
                <div className={styles.profileRow}>
                  <Mail size={14} className={styles.profileRowIcon} />
                  <span className={styles.profileRowLabel}>Email</span>
                  <span className={styles.profileRowValue}>{user?.email || '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <AtSign size={14} className={styles.profileRowIcon} />
                  <span className={styles.profileRowLabel}>Username</span>
                  <span className={styles.profileRowValue}>{user?.username || '—'}</span>
                </div>
                <div className={styles.profileRow}>
                  <User size={14} className={styles.profileRowIcon} />
                  <span className={styles.profileRowLabel}>Full Name</span>
                  <span className={styles.profileRowValue}>{user?.full_name || <span className={styles.profileRowMuted}>Not set</span>}</span>
                </div>
                <div className={styles.profileRow}>
                  <Calendar size={14} className={styles.profileRowIcon} />
                  <span className={styles.profileRowLabel}>Member Since</span>
                  <span className={styles.profileRowValue}>
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.optionBlock} style={{ marginTop: 24 }}>
        <button
          className={`${styles.optionRow} ${openPanel === 'delete' ? styles.deleteRowActive : ''}`}
          onClick={() => { setOpenPanel(openPanel === 'delete' ? null : 'delete'); setDeletePw(''); setDeleteConfirm(''); setDeleteMsg(null) }}
          disabled={busy}
        >
          <div className={styles.deleteIcon}><Trash2 size={16} /></div>
          <div className={styles.optionText}>
            <span className={styles.deleteLabel}>Delete Account</span>
            <span className={styles.optionHint}>Permanently remove your account and all data</span>
          </div>
          <ChevronRight size={16} className={`${styles.optionChevron} ${openPanel === 'delete' ? styles.optionChevronOpen : ''}`} />
        </button>

        {openPanel === 'delete' && (
          <div className={styles.deletePanel}>
            <div className={styles.deleteCard}>
              <div className={styles.deleteWarningBanner}>
                <AlertTriangle size={16} />
                <span>Deleting your account is permanent. You will lose all your data immediately.</span>
              </div>

              <div className={styles.deleteCardBody}>
                <p className={styles.deleteBodyLabel}>The following will be permanently deleted:</p>
                <ul className={styles.deleteList}>
                  <li>All chat sessions and messages</li>
                  <li>Connected MCP servers and configurations</li>
                  <li>Your account credentials and profile</li>
                </ul>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Your password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className={`${styles.formInput} ${styles.deleteFieldInput}`}
                      style={{ width: '100%', paddingRight: 36 }}
                      type={showDeletePw ? 'text' : 'password'}
                      value={deletePw}
                      onChange={e => { setDeletePw(e.target.value); setDeleteMsg(null) }}
                      placeholder="Enter your password"
                      disabled={deleting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePw(!showDeletePw)}
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: deleting ? 'not-allowed' : 'pointer', padding: 4,
                      }}
                      tabIndex={-1}
                    >
                      {showDeletePw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Type <strong className={styles.deleteKeyword}>DELETE</strong> to confirm</label>
                  <input
                    className={`${styles.formInput} ${styles.deleteFieldInput}`}
                    style={{ width: '100%' }}
                    type="text"
                    value={deleteConfirm}
                    onChange={e => { setDeleteConfirm(e.target.value); setDeleteMsg(null) }}
                    placeholder="DELETE"
                    disabled={deleting}
                  />
                </div>

                {deleteMsg && <span className={`${styles.formMsgPlain} ${styles.formMsgPlainError} ${styles.deleteMsgSmall}`}>{deleteMsg}</span>}
              </div>

              <div className={styles.deleteCardFooter}>
                <button className={styles.deleteCancelBtn} onClick={() => { setOpenPanel(null); setDeletePw(''); setDeleteConfirm(''); setDeleteMsg(null) }} disabled={deleting}>Cancel</button>
                <button
                  className={styles.deleteAccountBtn}
                  onClick={handleDeleteAccount}
                  disabled={deleting || !canDelete}
                >
                  {deleting ? <Loader2 size={15} className={styles.spinner} /> : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SecurityTab({ user, onUserUpdated, busy, onBusyChange }) {
  const [openPanel, setOpenPanel] = useState(null)

  const [username, setUsername] = useState(user?.username || '')
  const [usernameMsg, setUsernameMsg] = useState(null)
  const [usernameSaving, setUsernameSaving] = useState(false)

  const usernameErr = (() => {
    const v = username.trim()
    if (!v || v === user?.username) return ''
    if (v.length < 3) return 'At least 3 characters'
    if (v.length > 30) return 'Max 30 characters'
    if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(v)) return 'Must start with a letter (letters, numbers, dots, hyphens, underscores)'
    return ''
  })()

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState(null)
  const [pwSaving, setPwSaving] = useState(false)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  const passStrength = useMemo(() => {
    if (!newPw) return { level: 0, label: '', color: '' }
    const passed = PASSWORD_RULES.filter((r) => r.test(newPw)).length
    if (passed <= 1) return { level: 0, label: '', color: '' }
    if (passed <= 2) return { level: 1, label: 'Weak', color: '#ef4444' }
    if (passed <= 3) return { level: 2, label: 'Fair', color: '#f59e0b' }
    if (passed <= 4) return { level: 3, label: 'Good', color: '#3b82f6' }
    return { level: 4, label: 'Strong', color: 'var(--accent)' }
  }, [newPw])

  const allRulesPass = newPw && PASSWORD_RULES.every((r) => r.test(newPw))
  const sameAsCurrent = currentPw && newPw && currentPw === newPw
  const confirmErr = confirmPw && newPw !== confirmPw ? 'Passwords do not match' : ''

  useEffect(() => {
    if (user?.username) setUsername(user.username)
  }, [user?.username])

  const togglePanel = useCallback((panel) => {
    setOpenPanel((prev) => {
      if (prev === panel) return null
      if (panel === 'username') {
        setUsernameMsg(null)
        setUsername(user?.username || '')
      }
      if (panel === 'password') {
        setPwMsg(null)
        setCurrentPw('')
        setNewPw('')
        setConfirmPw('')
        setShowCurrentPw(false)
        setShowNewPw(false)
      }
      return panel
    })
  }, [user?.username])

  const handleUsernameSubmit = useCallback(async (e) => {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed || trimmed === user?.username) return

    setUsernameSaving(true)
    setUsernameMsg(null)
    onBusyChange?.(true)
    try {
      const res = await apiChangeUsername(trimmed)
      setUsernameMsg({ type: 'success', text: res.message || 'Username updated.' })
      if (res.user && onUserUpdated) onUserUpdated(res.user)
    } catch (err) {
      setUsernameMsg({ type: 'error', text: err.message || 'Failed to update username.' })
    } finally {
      setUsernameSaving(false)
      onBusyChange?.(false)
    }
  }, [username, user?.username, onUserUpdated, onBusyChange])

  const pwValid = currentPw && newPw && confirmPw && allRulesPass && !sameAsCurrent && !confirmErr

  const handlePasswordSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!pwValid) return

    setPwSaving(true)
    setPwMsg(null)
    onBusyChange?.(true)
    try {
      const res = await apiChangePassword(currentPw, newPw, confirmPw)
      setPwMsg({ type: 'success', text: res.message || 'Password updated.' })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setShowCurrentPw(false)
      setShowNewPw(false)
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || 'Failed to update password.' })
    } finally {
      setPwSaving(false)
      onBusyChange?.(false)
    }
  }, [currentPw, newPw, confirmPw, onBusyChange])

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Security</span>
        <span className={styles.sectionHint}>Manage your credentials</span>
      </div>

      {/* Change Username */}
      <div className={styles.optionBlock}>
        <button
          className={`${styles.optionRow} ${openPanel === 'username' ? styles.optionRowActive : ''}`}
          onClick={() => togglePanel('username')}
          disabled={busy}
        >
          <div className={styles.optionIcon}><AtSign size={16} /></div>
          <div className={styles.optionText}>
            <span className={styles.optionLabel}>Change Username</span>
            <span className={styles.optionHint}>{user?.username || 'Not set'}</span>
          </div>
          <ChevronRight size={16} className={`${styles.optionChevron} ${openPanel === 'username' ? styles.optionChevronOpen : ''}`} />
        </button>

        {openPanel === 'username' && (
          <form className={styles.optionPanel} onSubmit={handleUsernameSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>New Username</label>
              <input
                className={styles.formInput}
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setUsernameMsg(null) }}
                placeholder="Enter new username"
                maxLength={30}
                autoFocus
                disabled={busy}
              />
              {usernameErr && <span className={styles.validationErr}>{usernameErr}</span>}
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.formBtnGhost} onClick={() => setOpenPanel(null)} disabled={busy}>Cancel</button>
              <button
                type="submit"
                className={styles.formBtn}
                disabled={busy || usernameSaving || !username.trim() || username.trim() === user?.username || !!usernameErr}
              >
                {usernameSaving ? <Loader2 size={15} className={styles.spinner} /> : 'Save'}
              </button>
            </div>
            {usernameMsg && (
              <span className={`${styles.formMsgPlain} ${usernameMsg.type === 'success' ? styles.formMsgPlainSuccess : styles.formMsgPlainError}`}>
                {usernameMsg.text}
              </span>
            )}
          </form>
        )}
      </div>

      {/* Change Password */}
      <div className={styles.optionBlock}>
        <button
          className={`${styles.optionRow} ${openPanel === 'password' ? styles.optionRowActive : ''}`}
          onClick={() => togglePanel('password')}
          disabled={busy}
        >
          <div className={styles.optionIcon}><KeyRound size={16} /></div>
          <div className={styles.optionText}>
            <span className={styles.optionLabel}>Change Password</span>
            <span className={styles.optionHint}>Update your account password</span>
          </div>
          <ChevronRight size={16} className={`${styles.optionChevron} ${openPanel === 'password' ? styles.optionChevronOpen : ''}`} />
        </button>

        {openPanel === 'password' && (
          <form className={styles.optionPanel} onSubmit={handlePasswordSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className={styles.formInput}
                  style={{ width: '100%', paddingRight: 36 }}
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => { setCurrentPw(e.target.value); setPwMsg(null) }}
                  placeholder="Enter current password"
                  autoFocus
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  disabled={busy}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: busy ? 'not-allowed' : 'pointer', padding: 4,
                  }}
                >
                  {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className={styles.formInput}
                  style={{ width: '100%', paddingRight: 36 }}
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => { setNewPw(e.target.value); setPwMsg(null) }}
                  placeholder="Enter new password"
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  disabled={busy}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: busy ? 'not-allowed' : 'pointer', padding: 4,
                  }}
                >
                  {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {newPw && (
                <>
                  <div className={styles.strengthArea}>
                    <div className={styles.strengthBar}>
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={styles.strengthSeg}
                          style={{
                            background: i <= passStrength.level ? passStrength.color : 'var(--border-default)',
                            transform: i <= passStrength.level ? 'scaleY(1)' : 'scaleY(0.6)',
                          }}
                        />
                      ))}
                    </div>
                    {passStrength.label && (
                      <span className={styles.strengthLabel} style={{ color: passStrength.color }}>
                        {passStrength.label}
                      </span>
                    )}
                  </div>
                  <div className={styles.rulesList}>
                    {PASSWORD_RULES.map((r, i) => {
                      const ok = r.test(newPw)
                      return (
                        <span key={i} className={`${styles.rule} ${ok ? styles.ruleOk : ''}`}>
                          {ok ? <Check size={10} /> : <XIcon size={10} />}
                          {r.label}
                        </span>
                      )
                    })}
                  </div>
                  {sameAsCurrent && (
                    <span className={styles.validationErr}>New password must be different from current password</span>
                  )}
                </>
              )}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Confirm New Password</label>
              <input
                className={styles.formInput}
                type="password"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setPwMsg(null) }}
                placeholder="Confirm new password"
                disabled={busy}
              />
              {confirmErr && <span className={styles.validationErr}>{confirmErr}</span>}
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.formBtnGhost} onClick={() => setOpenPanel(null)} disabled={busy}>Cancel</button>
              <button
                type="submit"
                className={styles.formBtn}
                disabled={busy || pwSaving || !pwValid}
              >
                {pwSaving ? <Loader2 size={15} className={styles.spinner} /> : 'Update Password'}
              </button>
            </div>
            {pwMsg && (
              <span className={`${styles.formMsgPlain} ${pwMsg.type === 'success' ? styles.formMsgPlainSuccess : styles.formMsgPlainError}`}>
                {pwMsg.text}
              </span>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

function ChatSessionsTab({ onSessionsDeleted, busy, onBusyChange }) {
  const [openPanel, setOpenPanel] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const togglePanel = useCallback((panel) => {
    setOpenPanel((prev) => {
      if (prev === panel) return null
      if (panel === 'export') setExportMsg(null)
      if (panel === 'delete') {
        setDeleteMsg(null)
        setDeleteConfirm('')
      }
      return panel
    })
  }, [])

  const handleExport = useCallback(async () => {
    setExporting(true)
    setExportMsg(null)
    onBusyChange?.(true)
    try {
      await exportAllChats()
      setExportMsg({ type: 'success', text: 'Chats exported successfully.' })
    } catch (err) {
      setExportMsg({ type: 'error', text: err.message || 'Export failed.' })
    } finally {
      setExporting(false)
      onBusyChange?.(false)
    }
  }, [onBusyChange])

  const handleDeleteAll = useCallback(async () => {
    setDeleting(true)
    setDeleteMsg(null)
    onBusyChange?.(true)
    try {
      const res = await deleteAllSessions()
      setDeleteMsg({ type: 'success', text: `Deleted ${res.deleted} session${res.deleted !== 1 ? 's' : ''} successfully.` })
      setDeleteConfirm('')
      if (onSessionsDeleted) onSessionsDeleted()
    } catch (err) {
      setDeleteMsg({ type: 'error', text: err.message || 'Failed to delete sessions.' })
    } finally {
      setDeleting(false)
      onBusyChange?.(false)
    }
  }, [onSessionsDeleted, onBusyChange])

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Chat Sessions</span>
        <span className={styles.sectionHint}>Export or delete your conversations</span>
      </div>

      {/* Export All Chats */}
      <div className={styles.optionBlock}>
        <button
          className={`${styles.optionRow} ${openPanel === 'export' ? styles.optionRowActive : ''}`}
          onClick={() => togglePanel('export')}
          disabled={busy}
        >
          <div className={styles.optionIcon}><Download size={16} /></div>
          <div className={styles.optionText}>
            <span className={styles.optionLabel}>Export All Chats</span>
            <span className={styles.optionHint}>Download as Word document</span>
          </div>
          <ChevronRight size={16} className={`${styles.optionChevron} ${openPanel === 'export' ? styles.optionChevronOpen : ''}`} />
        </button>

        {openPanel === 'export' && (
          <div className={styles.optionPanel}>
            <p className={styles.panelDesc}>
              Export all your conversations to a <strong>.docx</strong> Word file. Each session will include the full message history with timestamps.
            </p>
            <div className={styles.formActions}>
              <button type="button" className={styles.formBtnGhost} onClick={() => setOpenPanel(null)} disabled={busy}>Cancel</button>
              <button
                type="button"
                className={styles.formBtn}
                onClick={handleExport}
                disabled={busy || exporting}
              >
                {exporting ? <Loader2 size={15} className={styles.spinner} /> : 'Export'}
              </button>
            </div>
            {exportMsg && (
              <span className={`${styles.formMsgPlain} ${exportMsg.type === 'success' ? styles.formMsgPlainSuccess : styles.formMsgPlainError}`}>
                {exportMsg.text}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Delete All Chats */}
      <div className={styles.optionBlock}>
        <button
          className={`${styles.optionRow} ${openPanel === 'delete' ? styles.optionRowActive : ''}`}
          onClick={() => togglePanel('delete')}
          disabled={busy}
        >
          <div className={`${styles.optionIcon} ${styles.optionIconDanger}`}><Trash2 size={16} /></div>
          <div className={styles.optionText}>
            <span className={styles.optionLabel}>Delete All Chats</span>
            <span className={styles.optionHint}>Permanently remove all conversations</span>
          </div>
          <ChevronRight size={16} className={`${styles.optionChevron} ${openPanel === 'delete' ? styles.optionChevronOpen : ''}`} />
        </button>

        {openPanel === 'delete' && (
          <div className={styles.optionPanel}>
            <div className={styles.dangerNotice}>
              <AlertTriangle size={16} />
              <span>This action is <strong>permanent</strong> and cannot be undone. All your chat sessions and messages will be deleted.</span>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Type <strong>DELETE</strong> to confirm</label>
              <input
                className={styles.formInput}
                type="text"
                value={deleteConfirm}
                onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteMsg(null) }}
                placeholder="DELETE"
                autoFocus
                disabled={busy}
              />
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.formBtnGhost} onClick={() => setOpenPanel(null)} disabled={busy}>Cancel</button>
              <button
                type="button"
                className={styles.formBtnDanger}
                onClick={handleDeleteAll}
                disabled={busy || deleting || deleteConfirm !== 'DELETE'}
              >
                {deleting ? <Loader2 size={15} className={styles.spinner} /> : 'Delete All'}
              </button>
            </div>
            {deleteMsg && (
              <span className={`${styles.formMsgPlain} ${deleteMsg.type === 'success' ? styles.formMsgPlainSuccess : styles.formMsgPlainError}`}>
                {deleteMsg.text}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const PLAN_ICONS = { free: Zap, pro: Crown, enterprise: Building2 }
const PLAN_COLORS = { free: '#6366f1', pro: 'var(--accent, #00c896)', enterprise: '#f59e0b' }

function UsageBar({ used, limit, color }) {
  if (limit === -1) return <span className={styles.billingUsageUnlimited}>Unlimited</span>
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const isHigh = pct >= 80
  return (
    <div className={styles.billingUsageBar}>
      <div className={styles.billingUsageTrack}>
        <div
          className={styles.billingUsageFill}
          style={{ width: `${pct}%`, background: isHigh ? '#ef4444' : (color || 'var(--accent)') }}
        />
      </div>
      <span className={`${styles.billingUsageText} ${isHigh ? styles.billingUsageHigh : ''}`}>
        {used} / {limit}
      </span>
    </div>
  )
}

function BillingTab({ user, onNavigate, busy }) {
  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    getSubscription().then(setSub).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleManage = useCallback(async () => {
    setPortalLoading(true)
    try {
      const { url } = await createPortalSession()
      if (url) window.location.href = url
    } catch {
      /* ignore */
    } finally {
      setPortalLoading(false)
    }
  }, [])

  const plan = sub?.plan || user?.plan || 'free'
  const PlanIcon = PLAN_ICONS[plan] || Zap
  const planColor = PLAN_COLORS[plan] || PLAN_COLORS.free
  const limits = sub?.limits || {}
  const usage = sub?.usage || {}
  const isActive = sub?.status === 'active' || sub?.status === 'trialing'
  const isPastDue = sub?.status === 'past_due'
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Billing</span>
        <span className={styles.sectionHint}>Manage your subscription and plan</span>
      </div>

      {loading ? (
        <div className={styles.billingLoading}>
          <Loader2 size={20} className={styles.spinner} />
          <span>Loading billing info...</span>
        </div>
      ) : (
        <>
          {/* Past due warning */}
          {isPastDue && (
            <div className={styles.billingWarning}>
              <AlertTriangle size={14} />
              <span>Your payment is overdue. Please update your payment method to avoid losing access.</span>
            </div>
          )}

          {/* Plan Card */}
          <div className={styles.billingPlanCard} style={{ '--plan-clr': planColor }}>
            <div className={styles.billingCardGlow} />
            <div className={styles.billingPlanTop}>
              <div className={styles.billingPlanIcon} style={{ background: planColor }}>
                <PlanIcon size={20} />
              </div>
              <div className={styles.billingPlanInfo}>
                <div className={styles.billingPlanName}>{planLabel} Plan</div>
                <div className={styles.billingPlanStatus}>
                  <span
                    className={styles.billingStatusDot}
                    style={{ background: isActive ? '#10b981' : isPastDue ? '#f59e0b' : plan === 'free' ? '#6366f1' : '#ef4444' }}
                  />
                  {plan === 'free' ? 'Free Tier' : isActive ? 'Active' : isPastDue ? 'Past Due' : sub?.status || 'Inactive'}
                </div>
              </div>
              {plan !== 'free' && (
                <div className={styles.billingPlanBadge} style={{ background: planColor }}>
                  {planLabel}
                </div>
              )}
            </div>
            {plan !== 'free' && sub?.end_date && (
              <div className={styles.billingRenew}>
                <Calendar size={12} />
                Renews {new Date(sub.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>

          {/* Usage section */}
          <div className={styles.billingLimitsHeader}>
            <Shield size={13} />
            <span>Usage &amp; Limits</span>
          </div>
          <div className={styles.billingLimits}>
            {[
              { icon: MessageSquare, label: 'Messages Today', used: usage.messages?.used ?? 0, limit: limits.messages_per_day, reset: 'Resets daily' },
              { icon: Layers, label: 'Sessions This Month', used: usage.sessions?.used ?? 0, limit: limits.sessions_per_month, reset: usage.sessions?.days_until_reset ? `Resets in ${usage.sessions.days_until_reset}d` : 'Resets monthly' },
              { icon: Server, label: 'MCP Servers', used: usage.mcps?.used ?? 0, limit: limits.mcps, reset: null },
            ].map(({ icon: LIcon, label, used, limit, reset }, i) => (
              <div key={i} className={styles.billingLimitItem}>
                <div className={styles.billingLimitIcon}><LIcon size={14} /></div>
                <div className={styles.billingLimitText}>
                  <div className={styles.billingLimitLabelRow}>
                    <span className={styles.billingLimitLabel}>{label}</span>
                    {reset && <span className={styles.billingLimitReset}>{reset}</span>}
                  </div>
                  <UsageBar used={used} limit={limit} color={planColor} />
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className={styles.billingActions}>
            {plan !== 'free' && (
              <button
                className={styles.billingManageBtn}
                onClick={handleManage}
                disabled={portalLoading || busy}
              >
                {portalLoading ? <Loader2 size={14} className={styles.spinner} /> : <ExternalLink size={14} />}
                Manage Subscription
              </button>
            )}
            <button
              className={styles.billingUpgradeBtn}
              onClick={() => onNavigate?.('pricing')}
            >
              <Rocket size={14} />
              {plan === 'free' ? 'Upgrade Plan' : 'View Plans'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function SettingsModal({ theme, onToggleTheme, onClose, user, onUserUpdated, onSessionsDeleted, onLogout, language, onLanguageChange, accentId, onAccentChange, onNavigate }) {
  const overlayRef = useRef(null)
  const [activeTab, setActiveTab] = useState('general')
  const [busy, setBusy] = useState(false)
  const { t } = useLanguage()

  const TABS = useMemo(() => [
    { id: 'general', label: t('general'), icon: Sun },
    { id: 'account', label: t('account'), icon: User },
    { id: 'security', label: t('security'), icon: Shield },
    { id: 'sessions', label: t('chatSessions'), icon: MessageSquare },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ], [t])

  const handleBusyChange = useCallback((isBusy) => setBusy(isBusy), [])

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleOverlay = (e) => {
    if (e.target === overlayRef.current && !busy) onClose()
  }

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <Settings size={18} />
            </div>
            <div>
              <h2 className={styles.title}>{t('settings')}</h2>
              <p className={styles.subtitle}>{t('customize')}</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.sidebar}>
            {TABS.map((tab) => {
              const Icon = tab.icon
                return (
                  <button
                  key={tab.id}
                  className={`${styles.sidebarItem} ${activeTab === tab.id ? styles.sidebarItemActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  disabled={busy}
                >
                  <Icon size={15} />
                  {tab.label}
                  </button>
                )
              })}
            </div>

          <div className={styles.content}>
            {activeTab === 'general' && (
              <GeneralTab
                theme={theme} onToggleTheme={onToggleTheme} busy={busy}
                language={language} onLanguageChange={onLanguageChange}
                accentId={accentId} onAccentChange={onAccentChange}
                t={t}
              />
            )}
            {activeTab === 'account' && (
              <AccountTab user={user} onLogout={onLogout} busy={busy} onBusyChange={setBusy} />
            )}
            {activeTab === 'security' && (
              <SecurityTab user={user} onUserUpdated={onUserUpdated} busy={busy} onBusyChange={handleBusyChange} />
            )}
            {activeTab === 'sessions' && (
              <ChatSessionsTab onSessionsDeleted={onSessionsDeleted} busy={busy} onBusyChange={handleBusyChange} />
            )}
            {activeTab === 'billing' && (
              <BillingTab user={user} onNavigate={(page) => { onClose(); onNavigate?.(page) }} busy={busy} />
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={onClose}>
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  )
}
