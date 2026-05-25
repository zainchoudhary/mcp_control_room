import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Settings, Sun, Moon, Check, User, Eye, EyeOff, ChevronRight, KeyRound, AtSign, Palette, UserCircle, Mail, Calendar, Loader2, Shield, MessageSquare, Download, Trash2, AlertTriangle, Globe, Droplets, CreditCard, Crown, Zap, Building2, ExternalLink, Rocket, Server, Layers, ArrowLeft, Bot, X as XIcon, PanelLeft, PanelLeftClose, LayoutDashboard, Monitor, SearchCheck, XCircle } from 'lucide-react'
import { changePassword as apiChangePassword, changeUsername as apiChangeUsername, deleteAllSessions, exportAllChats, deleteAccount as apiDeleteAccount, getSubscription, createPortalSession, getUsage, checkUsernameAvailability, listAccountDevices, removeAccountDevice, getSecuritySettings } from '../api.js'
import { SecurityFeatures } from './SecurityFeatures.jsx'
import { logout } from '../auth.js'
import { getClientDeviceId, clearClientDeviceId } from '../utils/deviceId.js'
import { LANGUAGES, useLanguage } from '../hooks/useLanguage.js'
import { ACCENT_COLORS } from '../hooks/useAccentColor.js'
import { STARTUP_PAGES } from '../hooks/usePreferences.js'
import { BG_OPTIONS } from '../utils/customBackground.js'
import styles from './SettingsModal.module.css'

const PASSWORD_RULES = [
  { test: (v) => v.length >= 8, label: '8+ characters' },
  { test: (v) => /[A-Z]/.test(v), label: 'Uppercase' },
  { test: (v) => /[a-z]/.test(v), label: 'Lowercase' },
  { test: (v) => /\d/.test(v), label: 'Number' },
  { test: (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(v), label: 'Special char' },
]

function SettingsGroup({ children, danger }) {
  return (
    <div className={danger ? styles.settingsGroupDanger : styles.settingsGroup}>
      {children}
    </div>
  )
}

function CollapsibleSection({ panelId, openPanel, onToggle, icon: Icon, label, hint, children, disabled, danger }) {
  const isOpen = openPanel === panelId
  return (
    <div className={`${styles.optionBlock} ${danger ? styles.optionBlockDanger : ''}`}>
      <button
        type="button"
        className={`${styles.optionRow} ${isOpen ? styles.optionRowActive : ''} ${danger && isOpen ? styles.deleteRowActive : ''}`}
        onClick={() => onToggle(panelId)}
        disabled={disabled}
        aria-expanded={isOpen}
      >
        {danger ? (
          <div className={styles.deleteIcon}><Icon size={16} /></div>
        ) : (
          <div className={styles.optionIcon}><Icon size={16} strokeWidth={2} /></div>
        )}
        <span className={danger ? styles.deleteLabel : styles.optionLabel}>{label}</span>
        {hint != null && hint !== '' && (
          <span className={`${styles.optionValue} ${danger ? styles.optionValueDanger : ''}`}>{hint}</span>
        )}
        <ChevronRight size={18} strokeWidth={2} className={`${styles.optionChevron} ${isOpen ? styles.optionChevronOpen : ''}`} />
      </button>
      {isOpen && <div className={styles.optionPanel}>{children}</div>}
    </div>
  )
}

const SHORTCUTS = [
  { label: 'New Chat', keys: ['Ctrl', 'Shift', 'N'] },
  { label: 'Toggle Sidebar', keys: ['Ctrl', 'B'] },
  { label: 'Settings', keys: ['Ctrl', ','] },
  { label: 'Search Chats', keys: ['Ctrl', 'K'] },
  { label: 'Dashboard', keys: ['Ctrl', 'D'] },
]

function ToggleSwitch({ on, onToggle, disabled }) {
  return (
    <button
      type="button"
      className={`${styles.toggleSwitch} ${on ? styles.toggleSwitchOn : ''}`}
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={on}
    >
      <span className={styles.toggleKnob} />
    </button>
  )
}

function GeneralTab({ theme, onToggleTheme, busy, language, onLanguageChange, accentId, onAccentChange, prefs, onSetPref, onTogglePref, t }) {
  const [openPanel, setOpenPanel] = useState(null)
  const togglePanel = useCallback((panel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel))
  }, [])
  const themes = [
    { id: 'light', label: t('lightTheme'), icon: Sun, desc: t('lightDesc') },
    { id: 'dark', label: t('darkTheme'), icon: Moon, desc: t('darkDesc') },
  ]

  const currentLabel = theme === 'dark' ? t('darkTheme') : t('lightTheme')
  const currentLang = LANGUAGES.find((l) => l.id === language)
  const currentAccent = ACCENT_COLORS.find((c) => c.id === accentId) || ACCENT_COLORS[0]

  const accentHint = (
    <>
      <span className={styles.accentDotInline} style={{ background: currentAccent.hex }} />
      {currentAccent.id === 'default' ? t('defaultColor') : currentAccent.label}
    </>
  )

  return (
    <div className={styles.section}>
      <SettingsGroup>
      <CollapsibleSection
        panelId="appearance"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={Palette}
        label={t('appearance')}
        hint={currentLabel}
        disabled={busy}
      >
        <div className={styles.themeGrid}>
          {themes.map((th) => {
            const ThIcon = th.icon
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
                    <ThIcon size={14} />
                    <span className={styles.themeLabel}>{th.label}</span>
                    {isActive && <Check size={14} className={styles.themeCheck} />}
                  </div>
                  <span className={styles.themeDesc}>{th.desc}</span>
                </div>
              </button>
            )
          })}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        panelId="language"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={Globe}
        label={t('language')}
        hint={`${currentLang?.flag || ''} ${currentLang?.label || ''}`.trim()}
        disabled={busy}
      >
        <div className={styles.langList}>
          {LANGUAGES.map((lang) => {
            const isActive = language === lang.id
            return (
              <button
                key={lang.id}
                type="button"
                className={`${styles.langBtn} ${isActive ? styles.langBtnActive : ''}`}
                onClick={() => onLanguageChange(lang.id)}
                disabled={busy}
              >
                <span className={styles.langFlag}>{lang.flag}</span>
                <span className={styles.langLabel}>{lang.label}</span>
                {isActive && <Check size={14} className={styles.langCheck} />}
              </button>
            )
          })}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        panelId="accent"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={Droplets}
        label={t('accentColor')}
        hint={accentHint}
        disabled={busy}
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        panelId="sidebarDefault"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={PanelLeft}
        label="Sidebar Collapse Default"
        hint={prefs?.sidebarCollapsedDefault ? 'Collapsed' : 'Expanded'}
        disabled={busy}
      >
        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleRowLabel}>Start with sidebar collapsed</div>
            <div className={styles.toggleRowHint}>App opens with the narrow icon-only sidebar</div>
          </div>
          <ToggleSwitch on={prefs?.sidebarCollapsedDefault} onToggle={() => onTogglePref?.('sidebarCollapsedDefault')} disabled={busy} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        panelId="animations"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={Zap}
        label="Animations"
        hint={prefs?.animationsEnabled ? 'On' : 'Off'}
        disabled={busy}
      >
        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleRowLabel}>Enable animations</div>
            <div className={styles.toggleRowHint}>Page transitions, panel slides, and hover effects</div>
          </div>
          <ToggleSwitch on={prefs?.animationsEnabled} onToggle={() => onTogglePref?.('animationsEnabled')} disabled={busy} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        panelId="shortcuts"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={KeyRound}
        label="Keyboard Shortcuts"
        hint="View all"
        disabled={busy}
      >
        <div className={styles.shortcutList}>
          {SHORTCUTS.map((s) => (
            <div key={s.label} className={styles.shortcutRow}>
              <span className={styles.shortcutLabel}>{s.label}</span>
              <div className={styles.shortcutKeys}>
                {s.keys.map((k, i) => (
                  <span key={i} className={styles.kbd}>{k}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        panelId="startupPage"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={LayoutDashboard}
        label="Startup Page"
        hint={STARTUP_PAGES.find((p) => p.id === prefs?.startupPage)?.label || 'Dashboard'}
        disabled={busy}
      >
        <div className={styles.startupList}>
          {STARTUP_PAGES.map((page) => {
            const isActive = prefs?.startupPage === page.id
            return (
              <button
                key={page.id}
                type="button"
                className={`${styles.startupBtn} ${isActive ? styles.startupBtnActive : ''}`}
                onClick={() => onSetPref?.('startupPage', page.id)}
                disabled={busy}
              >
                <span>{page.label}</span>
                {isActive && <Check size={14} className={styles.langCheck} />}
              </button>
            )
          })}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        panelId="customBg"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={Palette}
        label="Custom Background"
        hint={BG_OPTIONS.find((b) => b.id === (prefs?.customBg || ''))?.label || 'Default'}
        disabled={busy}
      >
        <div className={styles.bgGrid}>
          {BG_OPTIONS.map((bg) => {
            const isActive = (prefs?.customBg || '') === bg.id
            return (
              <button
                key={bg.id}
                type="button"
                className={`${styles.bgOption} ${isActive ? styles.bgOptionActive : ''}`}
                onClick={() => onSetPref?.('customBg', bg.id)}
                disabled={busy}
              >
                <div className={styles.bgSwatch} style={{ background: bg.swatch, backgroundSize: bg.id === 'subtle-dots' ? '16px 16px' : bg.id === 'subtle-grid' ? '20px 20px' : undefined }} />
                <span className={styles.bgLabel}>{bg.label}</span>
              </button>
            )
          })}
        </div>
      </CollapsibleSection>
      </SettingsGroup>
    </div>
  )
}

function formatActivityDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function AccountTab({ user, onLogout, busy, onBusyChange }) {
  const [openPanel, setOpenPanel] = useState(null)
  const [deletePw, setDeletePw] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteMsg, setDeleteMsg] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeletePw, setShowDeletePw] = useState(false)

  const [devices, setDevices] = useState([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [devicesError, setDevicesError] = useState(null)
  const [removingDeviceId, setRemovingDeviceId] = useState(null)

  const [checkUsername, setCheckUsername] = useState('')
  const [checkResult, setCheckResult] = useState(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const checkDebounceRef = useRef(null)

  const clientDeviceId = user?.id ? getClientDeviceId(user.id) : null

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true)
    setDevicesError(null)
    try {
      const data = await listAccountDevices()
      setDevices(data.devices || [])
    } catch (err) {
      setDevicesError(err.message || 'Failed to load devices.')
      setDevices([])
    } finally {
      setDevicesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (openPanel === 'devices') loadDevices()
  }, [openPanel, loadDevices])

  useEffect(() => {
    if (openPanel !== 'usernameCheck') return
    const q = checkUsername.trim()
    if (!q || q.length < 3) {
      setCheckResult(null)
      setCheckingUsername(false)
      return
    }
    if (checkDebounceRef.current) clearTimeout(checkDebounceRef.current)
    setCheckingUsername(true)
    checkDebounceRef.current = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(q)
        setCheckResult(res)
      } catch (err) {
        setCheckResult({ valid: false, available: false, message: err.message || 'Check failed.' })
      } finally {
        setCheckingUsername(false)
      }
    }, 400)
    return () => {
      if (checkDebounceRef.current) clearTimeout(checkDebounceRef.current)
    }
  }, [checkUsername, openPanel])

  const handleRemoveDevice = async (device) => {
    const isCurrent = device.client_device_id === clientDeviceId
    setRemovingDeviceId(device.id)
    onBusyChange?.(true)
    try {
      await removeAccountDevice(device.id)
      if (isCurrent) {
        clearClientDeviceId(user.id)
        logout()
        onLogout?.()
        return
      }
      await loadDevices()
    } catch (err) {
      setDevicesError(err.message || 'Failed to remove device.')
    } finally {
      setRemovingDeviceId(null)
      onBusyChange?.(false)
    }
  }

  const togglePanel = useCallback((panel) => {
    setOpenPanel((prev) => {
      if (prev === panel) {
        if (panel === 'delete') {
          setDeletePw('')
          setDeleteConfirm('')
          setDeleteMsg(null)
        }
        if (panel === 'usernameCheck') {
          setCheckUsername('')
          setCheckResult(null)
        }
        return null
      }
      return panel
    })
  }, [])

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
      <SettingsGroup>
      <CollapsibleSection
        panelId="info"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={UserCircle}
        label="Personal Information"
        hint={user?.email || 'View details'}
      >
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
            <span className={styles.profileRowValue}>
              {user?.full_name || <span className={styles.profileRowMuted}>Not set</span>}
            </span>
          </div>
          <div className={styles.profileRow}>
            <Calendar size={14} className={styles.profileRowIcon} />
            <span className={styles.profileRowLabel}>Member Since</span>
            <span className={styles.profileRowValue}>
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : '—'}
            </span>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        panelId="devices"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={Monitor}
        label="Connected Devices"
        hint={devices.length ? `${devices.length} device${devices.length !== 1 ? 's' : ''}` : 'Browsers signed in'}
        disabled={busy}
      >
        {devicesLoading ? (
          <div className={styles.panelLoading}><Loader2 size={20} className={styles.spinner} /></div>
        ) : devicesError ? (
          <p className={styles.panelError}>{devicesError}</p>
        ) : (
          <>
            <p className={styles.panelDesc}>
              Devices that have signed in to your account. Remove any you do not recognize.
            </p>
            {devices.length === 0 ? (
              <p className={styles.panelEmpty}>No devices registered yet. Sign in again from this browser to register it.</p>
            ) : (
              <ul className={styles.deviceList}>
                {devices.map((d) => {
                  const isCurrent = d.client_device_id === clientDeviceId
                  return (
                    <li key={d.id} className={`${styles.deviceItem} ${isCurrent ? styles.deviceItemCurrent : ''}`}>
                      <div className={styles.deviceItemMain}>
                        <Monitor size={16} className={styles.deviceItemIcon} />
                        <div>
                          <div className={styles.deviceItemLabel}>
                            {d.label}
                            {isCurrent && <span className={styles.deviceBadge}>This device</span>}
                          </div>
                          <div className={styles.deviceItemMeta}>
                            Last seen {formatActivityDate(d.last_seen_at)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.deviceRemoveBtn}
                        onClick={() => handleRemoveDevice(d)}
                        disabled={busy || removingDeviceId === d.id}
                      >
                        {removingDeviceId === d.id ? <Loader2 size={14} className={styles.spinner} /> : 'Remove'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        panelId="usernameCheck"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={SearchCheck}
        label="Username Availability Checker"
        hint="Check before changing"
        disabled={busy}
      >
        <p className={styles.panelDesc}>
          See if a username is available before you change it in Security → Change Username.
        </p>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Username to check</label>
          <input
            className={styles.formInput}
            type="text"
            value={checkUsername}
            onChange={(e) => setCheckUsername(e.target.value)}
            placeholder={user?.username ? `e.g. new_${user.username}` : 'Enter a username'}
            disabled={busy}
            autoComplete="off"
          />
        </div>
        {checkingUsername && (
          <div className={styles.checkStatus}><Loader2 size={14} className={styles.spinner} /> Checking…</div>
        )}
        {!checkingUsername && checkResult && (
          <div className={`${styles.checkResult} ${checkResult.available ? styles.checkResultOk : styles.checkResultBad}`}>
            {checkResult.available ? <Check size={16} /> : <XCircle size={16} />}
            <span>{checkResult.message}</span>
          </div>
        )}
        {!checkingUsername && checkUsername.trim().length > 0 && checkUsername.trim().length < 3 && (
          <p className={styles.panelHint}>Enter at least 3 characters.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        panelId="delete"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={Trash2}
        label="Delete Account"
        hint="Permanent"
        disabled={busy}
      >
        <div className={styles.deleteCard}>
          <p className={styles.panelDesc}>
            Deleting your account is permanent. You will lose all your data immediately.
          </p>
          <div className={styles.deleteCardBody}>
            <p className={styles.deleteBodyLabel}>The following will be permanently deleted:</p>
            <ul className={styles.deleteList}>
              <li>All chat sessions and messages</li>
              <li>Connected MCP servers and configurations</li>
              <li>Your account credentials and profile</li>
            </ul>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Your password</label>
              <div className={styles.inputWrap}>
                <input
                  className={styles.formInput}
                  type={showDeletePw ? 'text' : 'password'}
                  value={deletePw}
                  onChange={(e) => { setDeletePw(e.target.value); setDeleteMsg(null) }}
                  placeholder="Enter your password"
                  disabled={deleting}
                />
                <button
                  type="button"
                  className={styles.inputToggle}
                  onClick={() => setShowDeletePw(!showDeletePw)}
                  tabIndex={-1}
                  disabled={deleting}
                >
                  {showDeletePw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                className={styles.formInput}
                type="text"
                value={deleteConfirm}
                onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteMsg(null) }}
                placeholder="DELETE"
                disabled={deleting}
              />
            </div>
            {deleteMsg && (
              <span className={`${styles.formMsgPlain} ${styles.formMsgPlainError} ${styles.deleteMsgSmall}`}>
                {deleteMsg}
              </span>
            )}
          </div>
          <div className={styles.deleteCardFooter}>
            <button
              type="button"
              className={styles.deleteCancelBtn}
              onClick={() => togglePanel('delete')}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.formBtn}
              onClick={handleDeleteAccount}
              disabled={deleting || !canDelete}
            >
              {deleting ? <Loader2 size={15} className={styles.spinner} /> : 'Delete Account'}
            </button>
          </div>
        </div>
      </CollapsibleSection>
      </SettingsGroup>
    </div>
  )
}

function SecurityTab({ user, onUserUpdated, busy, onBusyChange }) {
  const [openPanel, setOpenPanel] = useState(null)
  const [security, setSecurity] = useState(user?.security || {})
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
  const [showConfirmPw, setShowConfirmPw] = useState(false)

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

  useEffect(() => {
    if (user?.security) setSecurity(user.security)
  }, [user?.security])

  useEffect(() => {
    if (!user?.id) return
    getSecuritySettings()
      .then((res) => setSecurity(res.security || {}))
      .catch(() => {})
  }, [user?.id])

  const handleSecurityChange = useCallback((next) => {
    setSecurity(next)
    if (onUserUpdated && user) onUserUpdated({ ...user, security: next })
  }, [user, onUserUpdated])

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
        setShowConfirmPw(false)
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
      <SettingsGroup>
      <CollapsibleSection
        panelId="username"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={AtSign}
        label="Change Username"
        hint={user?.username || 'Not set'}
        disabled={busy}
      >
        <form onSubmit={handleUsernameSubmit}>
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
      </CollapsibleSection>

      <CollapsibleSection
        panelId="password"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={KeyRound}
        label="Change Password"
        hint="Update password"
        disabled={busy}
      >
        <form onSubmit={handlePasswordSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Current Password</label>
            <div className={styles.inputWrap}>
              <input
                className={styles.formInput}
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => { setCurrentPw(e.target.value); setPwMsg(null) }}
                placeholder="Enter current password"
                autoFocus
                disabled={busy}
              />
              <button type="button" className={styles.inputToggle} onClick={() => setShowCurrentPw(!showCurrentPw)} disabled={busy}>
                {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>New Password</label>
            <div className={styles.inputWrap}>
              <input
                className={styles.formInput}
                type={showNewPw ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value); setPwMsg(null) }}
                placeholder="Enter new password"
                disabled={busy}
              />
              <button type="button" className={styles.inputToggle} onClick={() => setShowNewPw(!showNewPw)} disabled={busy}>
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
                    <span className={styles.strengthLabel} style={{ color: passStrength.color }}>{passStrength.label}</span>
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
            <div className={styles.inputWrap}>
              <input
                className={styles.formInput}
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setPwMsg(null) }}
                placeholder="Confirm new password"
                disabled={busy}
              />
              <button type="button" className={styles.inputToggle} onClick={() => setShowConfirmPw(!showConfirmPw)} disabled={busy}>
                {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmErr && <span className={styles.validationErr}>{confirmErr}</span>}
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.formBtnGhost} onClick={() => setOpenPanel(null)} disabled={busy}>Cancel</button>
            <button type="submit" className={styles.formBtn} disabled={busy || pwSaving || !pwValid}>
              {pwSaving ? <Loader2 size={15} className={styles.spinner} /> : 'Update Password'}
            </button>
          </div>
          {pwMsg && (
            <span className={`${styles.formMsgPlain} ${pwMsg.type === 'success' ? styles.formMsgPlainSuccess : styles.formMsgPlainError}`}>
              {pwMsg.text}
            </span>
          )}
        </form>
      </CollapsibleSection>

        <SecurityFeatures
          user={user}
          security={security}
          onSecurityChange={handleSecurityChange}
          busy={busy}
          onBusyChange={onBusyChange}
          openPanel={openPanel}
          onTogglePanel={togglePanel}
          CollapsibleSection={CollapsibleSection}
        />
      </SettingsGroup>
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
      <SettingsGroup>
      <CollapsibleSection
        panelId="export"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={Download}
        label="Export All Chats"
        hint="Download as Word document"
        disabled={busy}
      >
        <p className={styles.panelDesc}>
          Export all your conversations to a <strong>.docx</strong> Word file. Each session will include the full message history with timestamps.
        </p>
        <div className={styles.formActions}>
          <button type="button" className={styles.formBtnGhost} onClick={() => setOpenPanel(null)} disabled={busy}>Cancel</button>
          <button type="button" className={styles.formBtn} onClick={handleExport} disabled={busy || exporting}>
            {exporting ? <Loader2 size={15} className={styles.spinner} /> : 'Export'}
          </button>
        </div>
        {exportMsg && (
          <span className={`${styles.formMsgPlain} ${exportMsg.type === 'success' ? styles.formMsgPlainSuccess : styles.formMsgPlainError}`}>
            {exportMsg.text}
          </span>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        panelId="delete"
        openPanel={openPanel}
        onToggle={togglePanel}
        icon={Trash2}
        label="Delete All Chats"
        hint="Permanent"
        disabled={busy}
      >
        <p className={styles.panelDesc}>
          This action is <strong>permanent</strong> and cannot be undone. All your chat sessions and messages will be deleted.
        </p>
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
            className={styles.formBtn}
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
      </CollapsibleSection>
      </SettingsGroup>
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
  const [openPanel, setOpenPanel] = useState('plan')
  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  const togglePanel = useCallback((panel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel))
  }, [])

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

  const planHint = plan === 'free' ? 'Free tier' : `${planLabel} · ${isActive ? 'Active' : isPastDue ? 'Past due' : sub?.status || 'Inactive'}`

  return (
    <div className={styles.section}>
      {loading ? (
        <div className={styles.billingLoading}>
          <Loader2 size={20} className={styles.spinner} />
          <span>Loading billing info...</span>
        </div>
      ) : (
        <>
          {isPastDue && (
            <div className={styles.billingWarning}>
              <AlertTriangle size={14} />
              <span>Your payment is overdue. Please update your payment method to avoid losing access.</span>
            </div>
          )}

          <SettingsGroup>
          <CollapsibleSection
            panelId="plan"
            openPanel={openPanel}
            onToggle={togglePanel}
            icon={Crown}
            label="Current Plan"
            hint={planHint}
            disabled={busy}
          >
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
                  <div className={styles.billingPlanBadge} style={{ background: planColor }}>{planLabel}</div>
                )}
              </div>
              {plan !== 'free' && sub?.end_date && (
                <div className={styles.billingRenew}>
                  <Calendar size={12} />
                  Renews {new Date(sub.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>
            <div className={styles.billingActions} style={{ marginTop: 16 }}>
              {plan !== 'free' && (
                <button className={styles.billingManageBtn} onClick={handleManage} disabled={portalLoading || busy}>
                  {portalLoading ? <Loader2 size={14} className={styles.spinner} /> : <ExternalLink size={14} />}
                  Manage Subscription
                </button>
              )}
              <button className={styles.billingUpgradeBtn} onClick={() => onNavigate?.('pricing')}>
                <Rocket size={14} />
                {plan === 'free' ? 'Upgrade Plan' : 'View Plans'}
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            panelId="usage"
            openPanel={openPanel}
            onToggle={togglePanel}
            icon={Shield}
            label="Usage & Limits"
            hint="Messages, sessions, MCP servers"
            disabled={busy}
          >
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
          </CollapsibleSection>
          </SettingsGroup>
        </>
      )}
    </div>
  )
}

function SettingsPanel({
  theme,
  onToggleTheme,
  user,
  onUserUpdated,
  onSessionsDeleted,
  onLogout,
  language,
  onLanguageChange,
  accentId,
  onAccentChange,
  onNavigate,
  onBack,
  sidebarCollapsed = false,
  onToggleSidebarCollapse,
  prefs,
  onSetPref,
  onTogglePref,
  variant = 'page',
}) {
  const [activeTab, setActiveTab] = useState('general')
  const [busy, setBusy] = useState(false)
  const [localAsideCollapsed, setLocalAsideCollapsed] = useState(false)
  const { t } = useLanguage()

  const isAsideControlled = onToggleSidebarCollapse != null
  const asideCollapsed = isAsideControlled ? sidebarCollapsed : localAsideCollapsed
  const toggleAsideCollapse = isAsideControlled
    ? onToggleSidebarCollapse
    : () => setLocalAsideCollapsed((c) => !c)

  const TABS = useMemo(() => [
    { id: 'general', label: t('general'), icon: Sun, description: t('customize') },
    { id: 'account', label: t('account'), icon: User, description: 'Profile and account lifecycle' },
    { id: 'security', label: t('security'), icon: Shield, description: 'Credentials and sign-in security' },
    { id: 'sessions', label: t('chatSessions'), icon: MessageSquare, description: 'Export or delete conversations' },
    { id: 'billing', label: 'Billing', icon: CreditCard, description: 'Plan, usage, and subscription' },
  ], [t])

  const activeTabMeta = TABS.find((tab) => tab.id === activeTab)

  const handleBusyChange = useCallback((isBusy) => setBusy(isBusy), [])

  const tabContent = (
    <>
      {activeTab === 'general' && (
        <GeneralTab
          theme={theme}
          onToggleTheme={onToggleTheme}
          busy={busy}
          language={language}
          onLanguageChange={onLanguageChange}
          accentId={accentId}
          onAccentChange={onAccentChange}
          prefs={prefs}
          onSetPref={onSetPref}
          onTogglePref={onTogglePref}
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
        <BillingTab user={user} onNavigate={onNavigate} busy={busy} />
      )}
    </>
  )

  if (variant === 'page') {
    return (
      <div className={styles.settingsLayout}>
        <aside className={`${styles.settingsAside} ${asideCollapsed ? styles.asideCollapsed : ''}`}>
          <div className={styles.asideTop}>
            <button
              type="button"
              className={styles.asideToggleBtn}
              onClick={toggleAsideCollapse}
              title={asideCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {asideCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
            {!asideCollapsed && (
              <>
                <button type="button" className={styles.backBtn} onClick={onBack} title="Back to app">
                  <ArrowLeft size={18} />
                </button>
                <div className={styles.asideBrand}>
                  <div className={styles.asideBrandIcon}><Bot size={16} /></div>
                  <div>
                    <span className={styles.asideBrandName}>ToolChain AI</span>
                    <span className={styles.asideBrandSub}>{t('settings')}</span>
                  </div>
                </div>
              </>
            )}
            {asideCollapsed && (
              <button type="button" className={styles.asideCollapsedBack} onClick={onBack} title="Back to app">
                <ArrowLeft size={18} />
              </button>
            )}
          </div>

          {asideCollapsed ? (
            <nav className={styles.asideCollapsedNav}>
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`${styles.asideCollapsedBtn} ${activeTab === tab.id ? styles.asideCollapsedBtnActive : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    disabled={busy}
                    title={tab.label}
                  >
                    <Icon size={18} />
                  </button>
                )
              })}
            </nav>
          ) : (
            <>
              <nav className={styles.asideNav}>
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`${styles.sidebarItem} ${activeTab === tab.id ? styles.sidebarItemActive : ''}`}
                      onClick={() => setActiveTab(tab.id)}
                      disabled={busy}
                    >
                      <Icon size={17} />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
              <p className={styles.asideHint}>{t('customize')}</p>
            </>
          )}
        </aside>

        <main className={styles.settingsMain}>
          <div className={styles.settingsMainHeader}>
            <h1 className={styles.mainTitle}>{activeTabMeta?.label || t('settings')}</h1>
            {activeTabMeta?.description && (
              <p className={styles.mainDesc}>{activeTabMeta.description}</p>
            )}
          </div>
          <div className={styles.content}>
            <div className={styles.settingsPane}>{tabContent}</div>
          </div>
        </main>
      </div>
    )
  }

  const panel = (
    <>
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
      </div>

      <div className={styles.body}>
        <div className={styles.sidebar}>
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
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
        <div className={styles.content}>{tabContent}</div>
      </div>
    </>
  )

  return panel
}

export function SettingsPage(props) {
  return <SettingsPanel {...props} variant="page" />
}

/** @deprecated Use SettingsPage via /settings route instead */
export function SettingsModal({ theme, onToggleTheme, onClose, ...rest }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleOverlay = (e) => {
    if (e.target === overlayRef.current) onClose?.()
  }

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlay}>
      <div className={styles.modal}>
        <SettingsPanel
          theme={theme}
          onToggleTheme={onToggleTheme}
          variant="modal"
          onNavigate={(page) => { onClose?.(); rest.onNavigate?.(page) }}
          {...rest}
        />
        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
