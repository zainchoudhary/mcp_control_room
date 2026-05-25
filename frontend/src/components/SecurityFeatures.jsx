import { useState, useCallback, useEffect } from 'react'
import {
  Smartphone, Lock, MailPlus, Loader2, Copy, Check, Eye, EyeOff,
} from 'lucide-react'
import {
  setRecoveryEmail,
  removeRecoveryEmail,
  setup2fa,
  enable2fa,
  disable2fa,
  setLockPin,
  removeLockPin,
} from '../api.js'
import { lockSession } from '../utils/websiteLock.js'
import styles from './SettingsModal.module.css'

function SecurityFeatures({ user, security, onSecurityChange, busy, onBusyChange, openPanel, onTogglePanel, CollapsibleSection }) {
  const [recoveryEmail, setRecoveryEmailInput] = useState('')
  const [recoveryPw, setRecoveryPw] = useState('')
  const [recoveryMsg, setRecoveryMsg] = useState(null)
  const [recoverySaving, setRecoverySaving] = useState(false)

  const [totpSetup, setTotpSetup] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpPw, setTotpPw] = useState('')
  const [totpMsg, setTotpMsg] = useState(null)
  const [totpBusy, setTotpBusy] = useState(false)

  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinPw, setPinPw] = useState('')
  const [pinMsg, setPinMsg] = useState(null)
  const [pinSaving, setPinSaving] = useState(false)

  const [copiedSecret, setCopiedSecret] = useState(false)

  useEffect(() => {
    if (security?.recovery_email) setRecoveryEmailInput(security.recovery_email)
  }, [security?.recovery_email])

  const handleRecoverySave = async (e) => {
    e.preventDefault()
    setRecoverySaving(true)
    setRecoveryMsg(null)
    onBusyChange?.(true)
    try {
      const res = await setRecoveryEmail(recoveryEmail.trim(), recoveryPw)
      onSecurityChange?.(res.security)
      setRecoveryMsg({ type: 'success', text: res.message })
      setRecoveryPw('')
    } catch (err) {
      setRecoveryMsg({ type: 'error', text: err.message })
    } finally {
      setRecoverySaving(false)
      onBusyChange?.(false)
    }
  }

  const handleRecoveryRemove = async () => {
    if (!recoveryPw) {
      setRecoveryMsg({ type: 'error', text: 'Enter your password to remove recovery email.' })
      return
    }
    setRecoverySaving(true)
    setRecoveryMsg(null)
    onBusyChange?.(true)
    try {
      const res = await removeRecoveryEmail(recoveryPw)
      onSecurityChange?.(res.security)
      setRecoveryEmailInput('')
      setRecoveryPw('')
      setRecoveryMsg({ type: 'success', text: res.message })
    } catch (err) {
      setRecoveryMsg({ type: 'error', text: err.message })
    } finally {
      setRecoverySaving(false)
      onBusyChange?.(false)
    }
  }

  const start2faSetup = async () => {
    setTotpBusy(true)
    setTotpMsg(null)
    onBusyChange?.(true)
    try {
      const res = await setup2fa()
      setTotpSetup(res)
      setTotpCode('')
    } catch (err) {
      setTotpMsg({ type: 'error', text: err.message })
    } finally {
      setTotpBusy(false)
      onBusyChange?.(false)
    }
  }

  const handle2faEnable = async (e) => {
    e.preventDefault()
    setTotpBusy(true)
    setTotpMsg(null)
    onBusyChange?.(true)
    try {
      const res = await enable2fa(totpCode, totpPw)
      onSecurityChange?.(res.security)
      setTotpSetup(null)
      setTotpCode('')
      setTotpPw('')
      setTotpMsg({ type: 'success', text: res.message })
      onTogglePanel(null)
    } catch (err) {
      setTotpMsg({ type: 'error', text: err.message })
    } finally {
      setTotpBusy(false)
      onBusyChange?.(false)
    }
  }

  const handle2faDisable = async (e) => {
    e.preventDefault()
    setTotpBusy(true)
    setTotpMsg(null)
    onBusyChange?.(true)
    try {
      const res = await disable2fa(totpCode, totpPw)
      onSecurityChange?.(res.security)
      setTotpCode('')
      setTotpPw('')
      setTotpMsg({ type: 'success', text: res.message })
    } catch (err) {
      setTotpMsg({ type: 'error', text: err.message })
    } finally {
      setTotpBusy(false)
      onBusyChange?.(false)
    }
  }

  const handlePinSave = async (e) => {
    e.preventDefault()
    if (pin !== pinConfirm) {
      setPinMsg({ type: 'error', text: 'PINs do not match.' })
      return
    }
    setPinSaving(true)
    setPinMsg(null)
    onBusyChange?.(true)
    try {
      const res = await setLockPin(pin, pinPw)
      onSecurityChange?.(res.security)
      lockSession(user.id)
      setPin('')
      setPinConfirm('')
      setPinPw('')
      setPinMsg({ type: 'success', text: res.message + ' App will lock on next visit.' })
    } catch (err) {
      setPinMsg({ type: 'error', text: err.message })
    } finally {
      setPinSaving(false)
      onBusyChange?.(false)
    }
  }

  const handlePinRemove = async () => {
    if (!pinPw) {
      setPinMsg({ type: 'error', text: 'Enter your password to remove PIN.' })
      return
    }
    setPinSaving(true)
    onBusyChange?.(true)
    try {
      const res = await removeLockPin(pinPw)
      onSecurityChange?.(res.security)
      setPinPw('')
      setPinMsg({ type: 'success', text: res.message })
    } catch (err) {
      setPinMsg({ type: 'error', text: err.message })
    } finally {
      setPinSaving(false)
      onBusyChange?.(false)
    }
  }

  const copySecret = () => {
    if (!totpSetup?.secret) return
    navigator.clipboard.writeText(totpSetup.secret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  const qrUrl = totpSetup?.provisioning_uri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpSetup.provisioning_uri)}`
    : null

  return (
    <>
      <CollapsibleSection
        panelId="recovery"
        openPanel={openPanel}
        onToggle={onTogglePanel}
        icon={MailPlus}
        label="Recovery Email"
        hint={security?.recovery_email ? 'Set' : 'Not set'}
        disabled={busy}
      >
        <p className={styles.securityDesc}>
          A backup email used for account recovery. Must be different from your sign-in email.
        </p>
        <form onSubmit={handleRecoverySave}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Recovery email</label>
            <input
              className={styles.formInput}
              type="email"
              value={recoveryEmail}
              onChange={(e) => { setRecoveryEmailInput(e.target.value); setRecoveryMsg(null) }}
              placeholder="backup@example.com"
              disabled={busy}
            />
          </div>
          <PasswordField
            label="Account password"
            value={recoveryPw}
            onChange={(v) => { setRecoveryPw(v); setRecoveryMsg(null) }}
            placeholder="Confirm with your password"
            disabled={busy}
          />
          <div className={styles.formActions}>
            {security?.recovery_email && (
              <button type="button" className={styles.formBtnGhost} onClick={handleRecoveryRemove} disabled={busy || recoverySaving}>
                Remove
              </button>
            )}
            <button type="submit" className={styles.formBtn} disabled={busy || recoverySaving || !recoveryEmail || !recoveryPw}>
              {recoverySaving ? <Loader2 size={15} className={styles.spinner} /> : 'Save'}
            </button>
          </div>
          {recoveryMsg && <Msg {...recoveryMsg} />}
        </form>
      </CollapsibleSection>

      <CollapsibleSection
        panelId="2fa"
        openPanel={openPanel}
        onToggle={onTogglePanel}
        icon={Smartphone}
        label="Two-Factor Authentication (2FA)"
        hint={security?.totp_enabled ? 'Enabled' : 'Off'}
        disabled={busy}
      >
        <p className={styles.securityDesc}>
          Use an authenticator app (Google Authenticator, Authy, 1Password) for an extra sign-in step.
        </p>
        {security?.totp_enabled ? (
          <form onSubmit={handle2faDisable}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>6-digit code</label>
              <input className={styles.formInput} inputMode="numeric" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} disabled={busy} />
            </div>
            <PasswordField
              label="Password"
              value={totpPw}
              onChange={setTotpPw}
              placeholder="Your account password"
              disabled={busy}
            />
            <div className={styles.formActions}>
              <button type="submit" className={`${styles.formBtn} ${styles.formBtnDanger}`} disabled={totpBusy || !totpCode || !totpPw}>
                {totpBusy ? <Loader2 size={15} className={styles.spinner} /> : 'Disable 2FA'}
              </button>
            </div>
            {totpMsg && <Msg {...totpMsg} />}
          </form>
        ) : (
          <>
            {!totpSetup ? (
              <div className={styles.formActions}>
                <button type="button" className={styles.formBtn} onClick={start2faSetup} disabled={totpBusy}>
                  {totpBusy ? <Loader2 size={15} className={styles.spinner} /> : 'Set up 2FA'}
                </button>
              </div>
            ) : (
              <form onSubmit={handle2faEnable}>
                {qrUrl && <img src={qrUrl} alt="QR code for authenticator" className={styles.totpQr} width={180} height={180} />}
                <div className={styles.totpSecretRow}>
                  <code className={styles.totpSecret}>{totpSetup.secret}</code>
                  <button type="button" className={styles.iconBtn} onClick={copySecret} title="Copy secret">
                    {copiedSecret ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Verification code</label>
                  <input className={styles.formInput} inputMode="numeric" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" disabled={busy} />
                </div>
                <PasswordField
                  label="Password"
                  value={totpPw}
                  onChange={setTotpPw}
                  placeholder="Your account password"
                  disabled={busy}
                />
                <div className={styles.formActions}>
                  <button type="submit" className={styles.formBtn} disabled={totpBusy || totpCode.length !== 6 || !totpPw}>
                    {totpBusy ? <Loader2 size={15} className={styles.spinner} /> : 'Enable 2FA'}
                  </button>
                </div>
                {totpMsg && <Msg {...totpMsg} />}
              </form>
            )}
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        panelId="lockpin"
        openPanel={openPanel}
        onToggle={onTogglePanel}
        icon={Lock}
        label="Website Lock PIN"
        hint={security?.lock_pin_set ? 'Active' : 'Off'}
        disabled={busy}
      >
        <p className={styles.securityDesc}>Lock ToolChain when you open the app or start a new session. Uses a 4–8 digit PIN.</p>
        {security?.lock_pin_set ? (
          <>
            <PasswordField
              label="Password to remove PIN"
              value={pinPw}
              onChange={setPinPw}
              placeholder="Your account password"
              disabled={busy}
            />
            <div className={styles.formActions}>
              <button type="button" className={`${styles.formBtn} ${styles.formBtnDanger}`} onClick={handlePinRemove} disabled={pinSaving || !pinPw}>
                {pinSaving ? <Loader2 size={15} className={styles.spinner} /> : 'Remove PIN'}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handlePinSave}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>New PIN (4–8 digits)</label>
              <input className={styles.formInput} inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} disabled={busy} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Confirm PIN</label>
              <input className={styles.formInput} inputMode="numeric" maxLength={8} value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))} disabled={busy} />
            </div>
            <PasswordField
              label="Account password"
              value={pinPw}
              onChange={setPinPw}
              placeholder="Confirm with your password"
              disabled={busy}
            />
            <div className={styles.formActions}>
              <button type="submit" className={styles.formBtn} disabled={pinSaving || pin.length < 4 || pin !== pinConfirm || !pinPw}>
                {pinSaving ? <Loader2 size={15} className={styles.spinner} /> : 'Set PIN'}
              </button>
            </div>
          </form>
        )}
        {pinMsg && <Msg {...pinMsg} />}
      </CollapsibleSection>
    </>
  )
}

function PasswordField({ label, value, onChange, placeholder, disabled }) {
  const [show, setShow] = useState(false)
  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel}>{label}</label>
      <div className={styles.inputWrap}>
        <input
          className={styles.formInput}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="current-password"
        />
        <button
          type="button"
          className={styles.inputToggle}
          onClick={() => setShow((s) => !s)}
          disabled={disabled}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}

function Msg({ type, text }) {
  return (
    <span className={`${styles.formMsgPlain} ${type === 'success' ? styles.formMsgPlainSuccess : styles.formMsgPlainError}`}>
      {text}
    </span>
  )
}

export { SecurityFeatures }
