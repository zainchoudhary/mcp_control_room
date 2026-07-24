import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  ArrowLeft, Shield, ChevronRight, ChevronDown, Check, Globe,
  FileText, Database, Sparkles, Plug, Lock, Cookie, Timer, UserCheck,
  Baby, RefreshCw, Mail, ShieldCheck, EyeOff, KeyRound, HandHeart,
  PanelLeftClose, PanelLeft,
} from 'lucide-react'
import { LANGUAGES } from '../hooks/useLanguage.js'
import { PRIVACY_CONTENT, PRIVACY_LAST_UPDATED, getPrivacyContent } from './privacyContent.js'
import styles from './PrivacyPolicyPage.module.css'

// Icons are constant across languages, matched to sections/highlights by index.
const SECTION_IDS = [
  'introduction', 'information-we-collect', 'how-we-use', 'third-party',
  'data-security', 'cookies', 'data-retention', 'your-rights',
  'childrens-privacy', 'changes', 'contact',
]
const SECTION_ICONS = [
  FileText, Database, Sparkles, Plug, Lock, Cookie, Timer, UserCheck,
  Baby, RefreshCw, Mail,
]
const HIGHLIGHT_ICONS = [ShieldCheck, KeyRound, HandHeart, EyeOff]

// Abstract graph / data-structure visuals, one per section (matched by index).
// All use currentColor (accent) so they adapt to the theme automatically.
const svgProps = {
  viewBox: '0 0 120 120',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const SECTION_ART = [
  // 0 Introduction — trend line graph
  () => (
    <svg {...svgProps}>
      <line x1="18" y1="98" x2="104" y2="98" strokeWidth="1.6" opacity="0.35" />
      <line x1="18" y1="98" x2="18" y2="24" strokeWidth="1.6" opacity="0.35" />
      <polyline points="24,84 46,58 66,70 100,30" />
      <polygon points="24,84 46,58 66,70 100,30 100,98 24,98" fill="currentColor" fillOpacity="0.1" stroke="none" />
      {[['24','84'],['46','58'],['66','70'],['100','30']].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="3.6" fill="currentColor" stroke="none" />
      ))}
    </svg>
  ),
  // 1 Information We Collect — bar chart
  () => (
    <svg {...svgProps}>
      <line x1="18" y1="100" x2="104" y2="100" strokeWidth="1.6" opacity="0.35" />
      {[['28','66'],['50','52'],['72','40'],['94','28']].map(([x,y],i)=>(
        <rect key={i} x={x} y={y} width="14" height={100 - Number(y)} rx="3"
          fill="currentColor" fillOpacity="0.16" />
      ))}
    </svg>
  ),
  // 2 How We Use — process flow of nodes
  () => (
    <svg {...svgProps}>
      <line x1="34" y1="34" x2="60" y2="60" />
      <line x1="60" y1="60" x2="86" y2="34" />
      <line x1="60" y1="60" x2="60" y2="94" />
      <circle cx="34" cy="30" r="10" fill="currentColor" fillOpacity="0.14" />
      <circle cx="86" cy="30" r="10" fill="currentColor" fillOpacity="0.14" />
      <circle cx="60" cy="60" r="12" fill="currentColor" fillOpacity="0.22" />
      <circle cx="60" cy="98" r="9" fill="currentColor" fillOpacity="0.14" />
    </svg>
  ),
  // 3 Third-Party & MCP — network graph
  () => (
    <svg {...svgProps}>
      <line x1="60" y1="60" x2="30" y2="30" />
      <line x1="60" y1="60" x2="92" y2="32" />
      <line x1="60" y1="60" x2="28" y2="90" />
      <line x1="60" y1="60" x2="94" y2="88" />
      <circle cx="30" cy="30" r="7" fill="currentColor" fillOpacity="0.16" />
      <circle cx="92" cy="32" r="7" fill="currentColor" fillOpacity="0.16" />
      <circle cx="28" cy="90" r="7" fill="currentColor" fillOpacity="0.16" />
      <circle cx="94" cy="88" r="7" fill="currentColor" fillOpacity="0.16" />
      <circle cx="60" cy="60" r="12" fill="currentColor" fillOpacity="0.28" />
    </svg>
  ),
  // 4 Data Storage & Security — shield + keyhole
  () => (
    <svg {...svgProps}>
      <path d="M60 20 L92 33 V62 C92 82 78 94 60 100 C42 94 28 82 28 62 V33 Z"
        fill="currentColor" fillOpacity="0.1" />
      <circle cx="60" cy="56" r="7" />
      <line x1="60" y1="63" x2="60" y2="76" />
    </svg>
  ),
  // 5 Cookies & Local Storage — data grid
  () => (
    <svg {...svgProps}>
      {[0,1,2].flatMap((r)=>[0,1,2].map((col)=>{
        const filled = (r+col)%2===0
        return (
          <rect key={`${r}-${col}`} x={30+col*22} y={30+r*22} width="16" height="16" rx="4"
            fill="currentColor" fillOpacity={filled?0.22:0.06} />
        )
      }))}
    </svg>
  ),
  // 6 Data Retention — ring progress + center
  () => (
    <svg {...svgProps}>
      <circle cx="60" cy="60" r="34" strokeWidth="2" opacity="0.28" />
      <circle cx="60" cy="60" r="34" strokeWidth="5"
        strokeDasharray="150 214" strokeDashoffset="0" transform="rotate(-90 60 60)" />
      <line x1="60" y1="60" x2="60" y2="40" strokeWidth="2.6" />
      <line x1="60" y1="60" x2="76" y2="66" strokeWidth="2.6" />
      <circle cx="60" cy="60" r="3.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  // 7 Your Rights — checklist
  () => (
    <svg {...svgProps}>
      {[34,60,86].map((y,i)=>(
        <g key={i}>
          <polyline points={`26,${y} 31,${y+5} 40,${y-5}`} strokeWidth="2.6" />
          <line x1="52" y1={y} x2="98" y2={y} strokeWidth="2.4" opacity="0.5" />
        </g>
      ))}
    </svg>
  ),
  // 8 Children's Privacy — shield + heart
  () => (
    <svg {...svgProps}>
      <path d="M60 22 L90 34 V60 C90 79 77 90 60 96 C43 90 30 79 30 60 V34 Z"
        fill="currentColor" fillOpacity="0.1" />
      <path d="M60 72 C50 64 44 58 44 52 C44 47 48 44 52 44 C55 44 58 46 60 49 C62 46 65 44 68 44 C72 44 76 47 76 52 C76 58 70 64 60 72 Z"
        fill="currentColor" fillOpacity="0.28" stroke="none" />
    </svg>
  ),
  // 9 Changes — circular refresh
  () => (
    <svg {...svgProps}>
      <path d="M84 44 A30 30 0 1 0 90 66" strokeWidth="2.6" />
      <polyline points="74,40 86,44 82,56" strokeWidth="2.6" />
      <circle cx="60" cy="60" r="6" fill="currentColor" fillOpacity="0.25" />
    </svg>
  ),
  // 10 Contact — broadcast waves
  () => (
    <svg {...svgProps}>
      <circle cx="60" cy="78" r="5" fill="currentColor" stroke="none" />
      <path d="M42 66 A26 26 0 0 1 78 66" strokeWidth="2.6" opacity="0.75" />
      <path d="M34 54 A40 40 0 0 1 86 54" strokeWidth="2.6" opacity="0.45" />
      <path d="M26 42 A54 54 0 0 1 94 42" strokeWidth="2.6" opacity="0.25" />
    </svg>
  ),
]

const RTL_LANGS = ['ur', 'ar']

// Only offer languages that actually have translated policy content.
const AVAILABLE_LANGS = LANGUAGES.filter((l) => PRIVACY_CONTENT[l.id])

function LanguageSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = AVAILABLE_LANGS.find((l) => l.id === value) || AVAILABLE_LANGS[0]

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={styles.langSelect} ref={ref}>
      <button
        type="button"
        className={styles.langTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe size={15} className={styles.langGlobe} />
        <span className={styles.langFlag}>{current.flag}</span>
        <span className={styles.langCurrent}>{current.label}</span>
        <ChevronDown size={15} className={`${styles.langCaret} ${open ? styles.langCaretOpen : ''}`} />
      </button>
      {open && (
        <div className={styles.langMenu} role="listbox">
          {AVAILABLE_LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="option"
              aria-selected={l.id === value}
              className={`${styles.langOption} ${l.id === value ? styles.langOptionActive : ''}`}
              onClick={() => { onChange(l.id); setOpen(false) }}
            >
              <span className={styles.langFlag}>{l.flag}</span>
              <span className={styles.langOptionLabel}>{l.label}</span>
              {l.id === value && <Check size={15} className={styles.langCheck} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function PrivacyPolicyPage({ onBack, language = 'en' }) {
  const initialLang = PRIVACY_CONTENT[language] ? language : 'en'
  const [lang, setLang] = useState(initialLang)
  const [activeId, setActiveId] = useState(SECTION_IDS[0])
  const [tocCollapsed, setTocCollapsed] = useState(false)
  const contentRef = useRef(null)

  const c = useMemo(() => getPrivacyContent(lang), [lang])
  const isRtl = RTL_LANGS.includes(lang)

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(`section-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          const id = visible[0].target.getAttribute('data-section-id')
          if (id) setActiveId(id)
        }
      },
      { root, rootMargin: '0px 0px -70% 0px', threshold: 0.1 }
    )
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(`section-${id}`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [lang])

  return (
    <div className={styles.page} dir={isRtl ? 'rtl' : 'ltr'}>
      {onBack && (
        <div className={styles.topRow}>
          <button type="button" className={styles.backBtn} onClick={onBack}>
            <ArrowLeft size={16} className={isRtl ? styles.flip : ''} />
            <span>Back</span>
          </button>
        </div>
      )}

      <div className={`${styles.layout} ${tocCollapsed ? styles.layoutCollapsed : ''}`}>
        {/* Fixed, collapsible TOC — does not scroll */}
        <nav className={styles.toc} aria-label={c.tocHeading}>
          <div className={styles.tocHead}>
            {!tocCollapsed && <span className={styles.tocHeading}>{c.tocHeading}</span>}
            <button
              type="button"
              className={styles.tocToggle}
              onClick={() => setTocCollapsed((v) => !v)}
              title={tocCollapsed ? 'Expand' : 'Collapse'}
              aria-label={tocCollapsed ? 'Expand contents' : 'Collapse contents'}
              aria-expanded={!tocCollapsed}
            >
              {tocCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
          <div className={styles.tocList}>
            {c.sections.map((section, i) => {
              const id = SECTION_IDS[i]
              const Icon = SECTION_ICONS[i]
              return (
                <button
                  key={id}
                  type="button"
                  className={`${styles.tocItem} ${activeId === id ? styles.tocItemActive : ''}`}
                  onClick={() => scrollToSection(id)}
                  title={section.title}
                >
                  <Icon size={15} className={styles.tocIcon} />
                  <span className={styles.tocLabel}>{section.title}</span>
                  <ChevronRight size={13} className={styles.tocChevron} />
                </button>
              )
            })}
          </div>
        </nav>

        {/* Scrollable content column */}
        <div className={styles.scrollColumn} ref={contentRef}>
          {/* Hero */}
          <div className={styles.hero}>
            <div className={styles.heroGlow} aria-hidden="true" />
            <div className={styles.heroIcon}><Shield size={30} strokeWidth={1.8} /></div>
            <div className={styles.heroContent}>
              <span className={styles.heroBadge}>
                <Shield size={12} /> {c.badge}
              </span>
              <h1 className={styles.heroTitle}>{c.title}</h1>
              <p className={styles.heroSubtitle}>{c.subtitle}</p>
            </div>
            <div className={styles.heroAside}>
              <LanguageSelect value={lang} onChange={setLang} />
              <span className={styles.updated}>
                <span className={styles.updatedDot} /> {c.updatedLabel}: {PRIVACY_LAST_UPDATED}
              </span>
            </div>
          </div>

          {/* Highlights */}
          <div className={styles.highlights}>
            {c.highlights.map((h, i) => {
              const Icon = HIGHLIGHT_ICONS[i]
              return (
                <div key={i} className={styles.highlightCard}>
                  <div className={styles.highlightIcon}><Icon size={18} /></div>
                  <div className={styles.highlightText}>
                    <span className={styles.highlightTitle}>{h.title}</span>
                    <span className={styles.highlightDesc}>{h.text}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <article className={styles.content}>
            {c.sections.map((section, index) => {
              const id = SECTION_IDS[index]
              const Icon = SECTION_ICONS[index]
              return (
                <section
                  key={id}
                  id={`section-${id}`}
                  data-section-id={id}
                  className={styles.section}
                >
                  <div className={styles.sectionMain}>
                    <div className={styles.sectionHead}>
                      <div className={styles.sectionIcon}><Icon size={18} strokeWidth={2} /></div>
                      <h2 className={styles.sectionTitle}>
                        <span className={styles.sectionNum}>{String(index + 1).padStart(2, '0')}</span>
                        {section.title}
                      </h2>
                    </div>
                    <div className={styles.sectionBody}>
                      {section.body?.map((p, i) => (
                        <p key={i} className={styles.paragraph}>{p}</p>
                      ))}
                      {section.list && (
                        <ul className={styles.list}>
                          {section.list.map((li, i) => {
                            const sep = li.indexOf(': ')
                            if (sep > 0 && sep < 40) {
                              return (
                                <li key={i} className={styles.listItem}>
                                  <strong className={styles.listLabel}>{li.slice(0, sep)}</strong>
                                  {li.slice(sep + 1)}
                                </li>
                              )
                            }
                            return <li key={i} className={styles.listItem}>{li}</li>
                          })}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className={styles.sectionArt} aria-hidden="true">
                    <div className={styles.artTile}>
                      {SECTION_ART[index]
                        ? SECTION_ART[index]()
                        : <Icon size={40} strokeWidth={1.6} className={styles.artIcon} />}
                    </div>
                  </div>
                </section>
              )
            })}

            <div className={styles.footerNote}>
              <FileText size={16} />
              <p>{c.footer}</p>
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
