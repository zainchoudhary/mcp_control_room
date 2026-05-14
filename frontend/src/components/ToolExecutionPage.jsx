import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Wrench, ChevronDown, Loader2, Bot, Copy, Check,
  Clock, Server, RotateCcw, Terminal, Zap, AlertCircle, X,
  Code2, FormInput,
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import oneLightTheme from 'react-syntax-highlighter/dist/esm/styles/prism/one-light'
import { executeTool, probeMCP } from '../api.js'
import styles from './ToolExecutionPage.module.css'

function useCurrentTheme() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') !== 'light'
  )
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

function prettify(raw) {
  if (raw == null) return { text: '', isJson: false }

  let data = raw

  if (Array.isArray(data)) {
    const blocks = data.filter(b => b && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string')
    if (blocks.length) data = blocks.map(b => b.text).join('\n')
  }

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return { text: JSON.stringify(parsed, null, 2), isJson: true }
    } catch {
      return { text: data, isJson: false }
    }
  }

  if (typeof data === 'object') {
    return { text: JSON.stringify(data, null, 2), isJson: true }
  }

  return { text: String(data), isJson: false }
}

function buildDefaultValue(schema) {
  if (!schema) return ''
  if (schema.default !== undefined) return schema.default
  switch (schema.type) {
    case 'boolean': return false
    case 'number': case 'integer': return ''
    default: return ''
  }
}

/* ── Reusable dropdown selector ── */
function DropdownSelect({ label, placeholder, value, displayValue, icon, options, onSelect, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.dropdown} ref={ref}>
        <button
          className={`${styles.dropdownTrigger} ${open ? styles.dropdownOpen : ''} ${value ? styles.dropdownFilled : ''}`}
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          type="button"
        >
          {value ? (
            <span className={styles.dropdownValue}>
              {icon}
              <span>{displayValue}</span>
            </span>
          ) : (
            <span className={styles.dropdownPlaceholder}>{placeholder}</span>
          )}
          <ChevronDown size={16} className={`${styles.dropdownChev} ${open ? styles.dropdownChevOpen : ''}`} />
        </button>
        {open && (
          <div className={styles.dropdownMenu}>
            {options.length === 0 ? (
              <div className={styles.dropdownEmpty}>No options available</div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  className={`${styles.dropdownItem} ${opt.id === value ? styles.dropdownItemActive : ''}`}
                  onClick={() => { onSelect(opt.id); setOpen(false) }}
                  type="button"
                >
                  {opt.icon && <span className={styles.dropdownItemIcon}>{opt.icon}</span>}
                  <div className={styles.dropdownItemText}>
                    <span className={styles.dropdownItemName}>{opt.name}</span>
                    {opt.desc && <span className={styles.dropdownItemDesc}>{opt.desc}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Param input field ── */
function ParamInput({ name, schema, value, onChange }) {
  const type = schema?.type || 'string'
  const enumVals = schema?.enum

  if (enumVals) {
    return (
      <select className={styles.formSelect} value={value} onChange={(e) => onChange(name, e.target.value)}>
        <option value="">Select...</option>
        {enumVals.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    )
  }
  if (type === 'boolean') {
    const isOn = value === true || value === 'true'
    return (
      <div className={styles.toggleWrap}>
        <button type="button" className={`${styles.toggle} ${isOn ? styles.toggleOn : ''}`} onClick={() => onChange(name, !isOn)} />
        <span className={styles.toggleLabel}>{isOn ? 'true' : 'false'}</span>
      </div>
    )
  }
  if (type === 'object' || type === 'array') {
    return (
      <textarea
        className={styles.formTextarea}
        value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={type === 'object' ? '{ "key": "value" }' : '["item1", "item2"]'}
        rows={4}
      />
    )
  }
  if (type === 'integer' || type === 'number') {
    return <input className={styles.formInput} type="number" value={value} onChange={(e) => onChange(name, e.target.value)} placeholder={`Enter ${name}`} />
  }
  return <input className={styles.formInput} type="text" value={value} onChange={(e) => onChange(name, e.target.value)} placeholder={schema?.description || `Enter ${name}`} />
}

/* ── Always-visible Output Panel ── */
function OutputPanel({ result, toolName, executing }) {
  const [copied, setCopied] = useState(false)
  const isDark = useCurrentTheme()
  const highlightStyle = isDark ? vscDarkPlus : oneLightTheme

  const formatted = result ? prettify(result.data) : null

  const handleCopy = () => {
    if (!formatted) return
    navigator.clipboard.writeText(formatted.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.outputPanel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitleRow}>
          <Terminal size={14} />
          <span className={styles.panelTitle}>Output</span>
          {result && (
            <span className={`${styles.panelBadge} ${result.ok ? styles.badgeOk : styles.badgeFail}`}>
              {result.ok ? 'Success' : 'Error'}
            </span>
          )}
        </div>
        {result && (
          <div className={styles.panelActions}>
            <span className={styles.panelTime}><Clock size={11} /> {result.elapsed}ms</span>
            <button className={styles.panelCopy} onClick={handleCopy}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      <div className={styles.panelBody}>
        {executing ? (
          <div className={styles.panelPlaceholder}>
            <Loader2 size={20} className={styles.panelSpinner} />
            <span>Executing {toolName}...</span>
          </div>
        ) : result ? (
          <>
            {toolName && <div className={styles.panelToolName}>{toolName}</div>}
            {formatted.isJson ? (
              <SyntaxHighlighter
                language="json"
                style={highlightStyle}
                wrapLongLines
                customStyle={{
                  background: 'transparent',
                  margin: 0,
                  padding: '14px 18px',
                  fontSize: '12.5px',
                  lineHeight: 1.6,
                }}
              >
                {formatted.text}
              </SyntaxHighlighter>
            ) : (
              <pre className={styles.panelPlainText}>{formatted.text}</pre>
            )}
          </>
        ) : (
          <div className={styles.panelPlaceholder}>
            <Terminal size={20} />
            <span>Execute a tool to see the response</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Tool detail card with form ── */
function ToolDetail({ tool, mcpId, onRunViaAgent, cachedForm, onFormChange, onResult, executing, setExecuting }) {
  const props = tool.parameters?.properties || {}
  const required = new Set(tool.parameters?.required || [])
  const paramNames = Object.keys(props).filter((k) => k !== 'user_id')

  const [values, setValues] = useState(() => {
    if (cachedForm?.values) return cachedForm.values
    const init = {}
    paramNames.forEach((k) => { init[k] = buildDefaultValue(props[k]) })
    return init
  })
  const [inputMode, setInputMode] = useState('form')
  const [rawJson, setRawJson] = useState('')
  const startRef = useRef(0)

  const buildRawFromValues = useCallback(() => {
    const obj = {}
    paramNames.forEach((k) => {
      const val = values[k]
      const type = props[k]?.type
      const def = props[k]?.default
      if (val !== '' && val !== undefined && val !== null) {
        if (type === 'boolean') obj[k] = val === true || val === 'true'
        else if (type === 'number' || type === 'integer') { const n = Number(val); obj[k] = isNaN(n) ? val : n }
        else if (type === 'object' || type === 'array') { try { obj[k] = JSON.parse(val) } catch { obj[k] = val } }
        else obj[k] = val
      } else {
        if (def !== undefined) obj[k] = def
        else if (type === 'integer' || type === 'number') obj[k] = 0
        else if (type === 'boolean') obj[k] = false
        else if (type === 'array') obj[k] = []
        else if (type === 'object') obj[k] = {}
        else obj[k] = 'string'
      }
    })
    return JSON.stringify(obj, null, 2)
  }, [values, paramNames, props])

  useEffect(() => {
    onFormChange?.(tool.name, { values })
  }, [values])

  const handleToggleMode = (mode) => {
    if (mode === inputMode) return
    if (mode === 'raw') {
      setRawJson(buildRawFromValues())
    } else {
      try {
        const obj = JSON.parse(rawJson)
        const newValues = {}
        paramNames.forEach((k) => {
          if (k in obj) {
            const v = obj[k]
            newValues[k] = typeof v === 'object' ? JSON.stringify(v, null, 2) : v
          } else {
            newValues[k] = buildDefaultValue(props[k])
          }
        })
        setValues(newValues)
      } catch { /* invalid JSON */ }
    }
    setInputMode(mode)
  }

  const handleChange = useCallback((name, val) => {
    setValues((prev) => ({ ...prev, [name]: val }))
  }, [])

  const buildArgs = () => {
    if (inputMode === 'raw') {
      try { return JSON.parse(rawJson) } catch { return {} }
    }
    const args = {}
    paramNames.forEach((k) => {
      const val = values[k]
      const type = props[k]?.type
      if (val === '' || val === undefined || val === null) return
      if (type === 'boolean') args[k] = val === true || val === 'true'
      else if (type === 'number' || type === 'integer') { const n = Number(val); if (!isNaN(n)) args[k] = n }
      else if (type === 'object' || type === 'array') { try { args[k] = JSON.parse(val) } catch { args[k] = val } }
      else args[k] = val
    })
    return args
  }

  const handleExecute = async () => {
    setExecuting(true)
    startRef.current = performance.now()
    try {
      const res = await executeTool(mcpId, tool.name, buildArgs())
      onResult({ ok: true, data: res.result, elapsed: Math.round(performance.now() - startRef.current) })
    } catch (err) {
      onResult({ ok: false, data: err.message, elapsed: Math.round(performance.now() - startRef.current) })
    } finally {
      setExecuting(false)
    }
  }

  const handleAgent = () => {
    const args = buildArgs()
    const parts = Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    onRunViaAgent(parts.length ? `Use the ${tool.name} tool with: ${parts.join(', ')}` : `Use the ${tool.name} tool`)
  }

  const handleClear = () => {
    onResult(null)
    const init = {}
    paramNames.forEach((k) => { init[k] = buildDefaultValue(props[k]) })
    setValues(init)
    setRawJson('')
  }

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailHeader}>
        <div className={styles.detailIcon}><Wrench size={16} /></div>
        <div className={styles.detailMeta}>
          <h3 className={styles.detailName}>{tool.name}</h3>
          {tool.description && <p className={styles.detailDesc}>{tool.description}</p>}
        </div>
      </div>

      <div className={styles.detailBody}>
        {paramNames.length === 0 ? (
          <p className={styles.noParams}>This tool takes no parameters</p>
        ) : (
          <>
            <div className={styles.paramBar}>
              <span className={styles.paramHeader}>Parameters</span>
              <div className={styles.modeToggle}>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${inputMode === 'form' ? styles.modeBtnActive : ''}`}
                  onClick={() => handleToggleMode('form')}
                >
                  <FormInput size={12} /> Form
                </button>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${inputMode === 'raw' ? styles.modeBtnActive : ''}`}
                  onClick={() => handleToggleMode('raw')}
                >
                  <Code2 size={12} /> Raw
                </button>
              </div>
            </div>

            {inputMode === 'form' ? (
              paramNames.map((k) => {
                const schema = props[k]
                return (
                  <div key={k} className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      {k}
                      {required.has(k) && <span className={styles.required}>*</span>}
                      <span className={styles.paramType}>{schema?.type || 'string'}</span>
                    </label>
                    {schema?.description && <p className={styles.paramDesc}>{schema.description}</p>}
                    <ParamInput name={k} schema={schema} value={values[k]} onChange={handleChange} />
                  </div>
                )
              })
            ) : (
              <textarea
                className={styles.rawTextarea}
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                rows={Math.max(6, paramNames.length * 2 + 2)}
                spellCheck={false}
              />
            )}
          </>
        )}

        <div className={styles.actions}>
          <button className={styles.execBtn} onClick={handleExecute} disabled={executing}>
            {executing ? <Loader2 size={14} /> : <Zap size={14} />}
            {executing ? 'Executing...' : 'Execute Directly'}
          </button>
          <button className={styles.agentBtn} onClick={handleAgent} disabled={executing}>
            <Bot size={14} /> Run via Agent
          </button>
          <button className={styles.clearBtn} onClick={handleClear} disabled={executing}>
            <RotateCcw size={13} /> Clear
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main page ── */
export function ToolExecutionPage({ connectedMcps, onNavigate, onRunViaAgent, t, persistedState, onStateChange }) {
  const tr = t || ((k) => k)
  const hasRestoredState = !!(persistedState?.mcpId && persistedState?.tools?.length)

  const [selectedMcpId, setSelectedMcpId] = useState(persistedState?.mcpId || null)
  const [tools, setTools] = useState(persistedState?.tools || null)
  const [probing, setProbing] = useState(false)
  const [probeError, setProbeError] = useState(null)
  const [selectedToolName, setSelectedToolName] = useState(persistedState?.toolName || null)
  const [result, setResult] = useState(persistedState?.formCache?._result || null)
  const [executing, setExecuting] = useState(false)
  const formCacheRef = useRef(persistedState?.formCache || {})

  const syncState = useCallback((overrides = {}) => {
    const snap = {
      mcpId: selectedMcpId,
      toolName: selectedToolName,
      tools,
      formCache: { ...formCacheRef.current, _result: result },
      ...overrides,
    }
    onStateChange?.(snap)
  }, [selectedMcpId, selectedToolName, tools, result, onStateChange])

  useEffect(() => { syncState() }, [selectedMcpId, selectedToolName, tools, result])

  useEffect(() => {
    if (hasRestoredState) return
    if (selectedMcpId && !probing) {
      probeMcpTools(selectedMcpId)
    } else if (!selectedMcpId && connectedMcps?.length === 1) {
      probeMcpTools(connectedMcps[0].id)
    }
  }, [])

  const handleFormChange = useCallback((toolName, data) => {
    formCacheRef.current = { ...formCacheRef.current, [toolName]: data }
    syncState()
  }, [syncState])

  const probeMcpTools = async (mcpId) => {
    setProbeError(null)
    setProbing(true)
    try {
      const res = await probeMCP(mcpId)
      if (res.ok) setTools(res.tools || [])
      else setProbeError(res.error || 'Failed to probe')
    } catch (err) {
      setProbeError(err.message)
    } finally {
      setProbing(false)
    }
  }

  const handleSelectMcp = async (mcpId) => {
    setSelectedMcpId(mcpId)
    setSelectedToolName(null)
    setTools(null)
    setResult(null)
    formCacheRef.current = {}
    await probeMcpTools(mcpId)
  }

  const handleSelectTool = (toolName) => {
    setSelectedToolName(toolName)
    setResult(null)
  }

  const selectedMcp = connectedMcps?.find((m) => m.id === selectedMcpId)
  const selectedTool = tools?.find((t) => t.name === selectedToolName)

  const mcpOptions = (connectedMcps || []).map((m) => ({
    id: m.id,
    name: m.name,
    icon: m.icon
      ? <img src={m.icon} alt="" className={styles.optIcon} onError={(e) => { e.target.style.display = 'none' }} />
      : <Server size={14} />,
  }))

  const toolOptions = (tools || []).map((t) => ({
    id: t.name,
    name: t.name,
    desc: t.description ? (t.description.length > 60 ? t.description.slice(0, 60) + '...' : t.description) : '',
    icon: <Wrench size={13} />,
  }))

  if (!connectedMcps || connectedMcps.length === 0) {
    return (
      <div className={styles.pageEmpty}>
        <div className={styles.header} style={{ padding: '32px 40px 0' }}>
          <h1 className={styles.title}>{tr('toolExecution')}</h1>
          <p className={styles.subtitle}>{tr('toolExecSubtitle')}</p>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><Wrench size={28} /></div>
          <h2 className={styles.emptyTitle}>{tr('noConnectedMcps')}</h2>
          <p className={styles.emptyDesc}>{tr('noConnectedMcpsDesc')}</p>
          <button className={styles.emptyLink} onClick={() => onNavigate('mcp-servers')}>
            {tr('goToMcpServers')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.splitLayout}>
        <div className={styles.leftPanel}>
          <div className={styles.header}>
            <h1 className={styles.title}>{tr('toolExecution')}</h1>
            <p className={styles.subtitle}>{tr('toolExecSubtitle')}</p>
          </div>
          <div className={styles.selectors}>
            <DropdownSelect
              label="Server"
              placeholder="Select an MCP server..."
              value={selectedMcpId}
              displayValue={selectedMcp?.name}
              icon={
                selectedMcp?.icon
                  ? <img src={selectedMcp.icon} alt="" className={styles.optIcon} onError={(e) => { e.target.style.display = 'none' }} />
                  : <Server size={14} />
              }
              options={mcpOptions}
              onSelect={handleSelectMcp}
            />
            {selectedMcpId && (
              <DropdownSelect
                label="Tool"
                placeholder={probing ? 'Loading tools...' : probeError ? 'Error loading tools' : 'Select a tool...'}
                value={selectedToolName}
                displayValue={selectedToolName}
                icon={<Wrench size={13} />}
                options={toolOptions}
                onSelect={handleSelectTool}
                disabled={probing || !!probeError || !tools}
              />
            )}
          </div>

          {probing && (
            <div className={styles.loadingBar}><Loader2 size={15} /> Loading tools from {selectedMcp?.name}...</div>
          )}
          {probeError && (
            <div className={styles.errorBar}><AlertCircle size={14} /> {probeError}</div>
          )}

          {selectedTool && (
            <ToolDetail
              key={selectedTool.name}
              tool={selectedTool}
              mcpId={selectedMcpId}
              onRunViaAgent={onRunViaAgent}
              cachedForm={formCacheRef.current[selectedTool.name]}
              onFormChange={handleFormChange}
              onResult={setResult}
              executing={executing}
              setExecuting={setExecuting}
            />
          )}
        </div>

        <div className={styles.rightPanel}>
          <OutputPanel
            result={result}
            toolName={selectedToolName}
            executing={executing}
          />
        </div>
      </div>
    </div>
  )
}
