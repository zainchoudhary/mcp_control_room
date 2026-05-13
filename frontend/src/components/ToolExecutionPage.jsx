import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Wrench, ChevronDown, Loader2, Bot, Copy, Check,
  Clock, Server, RotateCcw, Terminal, Zap, AlertCircle, X,
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { executeTool, probeMCP } from '../api.js'
import styles from './ToolExecutionPage.module.css'

function prettify(raw) {
  if (typeof raw === 'string') {
    try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
  }
  try { return JSON.stringify(raw, null, 2) } catch { return String(raw) }
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

/* ── Tool detail card with form ── */
function ToolDetail({ tool, mcpId, onRunViaAgent, cachedForm, onFormChange }) {
  const props = tool.parameters?.properties || {}
  const required = new Set(tool.parameters?.required || [])
  const paramNames = Object.keys(props).filter((k) => k !== 'user_id')

  const [values, setValues] = useState(() => {
    if (cachedForm?.values) return cachedForm.values
    const init = {}
    paramNames.forEach((k) => { init[k] = buildDefaultValue(props[k]) })
    return init
  })
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState(cachedForm?.result || null)
  const [copied, setCopied] = useState(false)
  const startRef = useRef(0)

  useEffect(() => {
    onFormChange?.(tool.name, { values, result })
  }, [values, result])

  const handleChange = useCallback((name, val) => {
    setValues((prev) => ({ ...prev, [name]: val }))
  }, [])

  const buildArgs = () => {
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
    setResult(null)
    startRef.current = performance.now()
    try {
      const res = await executeTool(mcpId, tool.name, buildArgs())
      setResult({ ok: true, data: res.result, elapsed: Math.round(performance.now() - startRef.current) })
    } catch (err) {
      setResult({ ok: false, data: err.message, elapsed: Math.round(performance.now() - startRef.current) })
    } finally {
      setExecuting(false)
    }
  }

  const handleAgent = () => {
    const args = buildArgs()
    const parts = Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    onRunViaAgent(parts.length ? `Use the ${tool.name} tool with: ${parts.join(', ')}` : `Use the ${tool.name} tool`)
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(prettify(result.data))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClear = () => {
    setResult(null)
    const init = {}
    paramNames.forEach((k) => { init[k] = buildDefaultValue(props[k]) })
    setValues(init)
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
            <div className={styles.paramHeader}>Parameters</div>
            {paramNames.map((k) => {
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
            })}
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
          {(result || paramNames.some((k) => values[k] !== '' && values[k] !== false)) && (
            <button className={styles.clearBtn} onClick={handleClear} disabled={executing}>
              <RotateCcw size={13} /> Clear
            </button>
          )}
        </div>

        {result && (
          <div className={`${styles.resultWrap} ${result.ok ? styles.resultSuccess : styles.resultError}`}>
            <div className={styles.resultBar}>
              <span className={styles.resultLabel}>
                <Terminal size={13} /> Response
                <span className={`${styles.resultStatus} ${result.ok ? styles.statusOk : styles.statusFail}`}>
                  {result.ok ? 'Success' : 'Error'}
                </span>
              </span>
              <div className={styles.resultMeta}>
                <span className={styles.resultTime}><Clock size={11} /> {result.elapsed}ms</span>
                <button className={styles.copyBtn} onClick={handleCopy}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div className={styles.resultCode}>
              <SyntaxHighlighter language="json" style={vscDarkPlus} wrapLongLines>
                {prettify(result.data)}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main page ── */
export function ToolExecutionPage({ connectedMcps, onNavigate, onRunViaAgent, t, persistedState, onStateChange }) {
  const tr = t || ((k) => k)
  const [selectedMcpId, setSelectedMcpId] = useState(persistedState?.mcpId || null)
  const [tools, setTools] = useState(persistedState?.tools || null)
  const [probing, setProbing] = useState(false)
  const [probeError, setProbeError] = useState(null)
  const [selectedToolName, setSelectedToolName] = useState(persistedState?.toolName || null)
  const formCacheRef = useRef(persistedState?.formCache || {})

  useEffect(() => {
    onStateChange?.({ mcpId: selectedMcpId, toolName: selectedToolName, tools, formCache: formCacheRef.current })
  }, [selectedMcpId, selectedToolName, tools])

  const handleFormChange = useCallback((toolName, data) => {
    formCacheRef.current = { ...formCacheRef.current, [toolName]: data }
    onStateChange?.({ mcpId: selectedMcpId, toolName: selectedToolName, tools, formCache: formCacheRef.current })
  }, [selectedMcpId, selectedToolName, tools])

  const handleSelectMcp = async (mcpId) => {
    setSelectedMcpId(mcpId)
    setSelectedToolName(null)
    setTools(null)
    setProbeError(null)
    setProbing(true)
    formCacheRef.current = {}
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

  const handleSelectTool = (toolName) => {
    setSelectedToolName(toolName)
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
      <div className={styles.page}>
        <div className={styles.header}>
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
      <div className={styles.header}>
        <h1 className={styles.title}>{tr('toolExecution')}</h1>
        <p className={styles.subtitle}>{tr('toolExecSubtitle')}</p>
      </div>

      <div className={styles.selectors}>
        {/* Step 1: Select MCP */}
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

        {/* Step 2: Select Tool */}
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
        <div className={styles.errorBar}>
          <AlertCircle size={14} /> {probeError}
        </div>
      )}

      {/* Step 3: Tool detail + form */}
      {selectedTool && (
        <ToolDetail
          key={selectedTool.name}
          tool={selectedTool}
          mcpId={selectedMcpId}
          onRunViaAgent={onRunViaAgent}
          cachedForm={formCacheRef.current[selectedTool.name]}
          onFormChange={handleFormChange}
        />
      )}
    </div>
  )
}
