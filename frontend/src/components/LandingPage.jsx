import { useEffect, useRef, useState } from 'react'
import {
  Bot, Zap, ArrowRight,
  Terminal, MessageSquare, Server, Workflow,
  Mail, Search, Database, FileText, Cloud, Lock,
  Users, Brain, Gauge, Play, Check,
  Activity, Sparkles, Shield, Code, Globe, ChevronRight,
} from 'lucide-react'
import styles from './LandingPage.module.css'

function Counter({ end, suffix = '', prefix = '' }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const dur = 2000, st = Date.now()
        const tick = () => {
          const p = Math.min((Date.now() - st) / dur, 1)
          setCount(Math.floor((1 - Math.pow(1 - p, 3)) * end))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end])
  return <span ref={ref}>{prefix}{count}{suffix}</span>
}

export function LandingPage({ onGetStarted, onSignIn }) {
  return (
    <div className={styles.page}>
      {/* ══════ NAV ══════ */}
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <div className={styles.logo}><Bot size={18} /></div>
          <span className={styles.logoText}>ToolChain<span>AI</span></span>
        </div>
        <div className={styles.navRight}>
          <button className={styles.navLink} onClick={onSignIn}>Log in</button>
          <button className={styles.navCta} onClick={onGetStarted}>Get started</button>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroPill}>
            <span className={styles.pillDot} />
            Public Beta — Join 2,000+ developers
          </div>
          <h1 className={styles.heroH1}>
            Give your LLMs<br />real-world tools.
          </h1>
          <p className={styles.heroSub}>
            Connect real tools. Execute real tasks. One platform for building,
            deploying, and scaling AI agents that actually do things.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.heroBtn} onClick={onGetStarted}>
              Get started <ArrowRight size={16} />
            </button>
            <button className={styles.heroBtnSec} onClick={onSignIn}>
              Sign in
            </button>
          </div>
        </div>

        {/* Hero Interactive Preview */}
        <div className={styles.heroPreview}>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <div className={styles.previewDots}><i /><i /><i /></div>
              <span>Agent Session</span>
              <div className={styles.previewLive}><span />Live</div>
            </div>
            <div className={styles.previewBody}>
              <div className={styles.pLine}>
                <span className={styles.pTag}>you</span>
                <span>Send the weekly report to my team via email</span>
              </div>
              <div className={styles.pLine}>
                <span className={`${styles.pTag} ${styles.pTool}`}>tool</span>
                <span className={styles.pCode}>query_reports(period: "weekly")</span>
              </div>
              <div className={styles.pLine}>
                <span className={`${styles.pTag} ${styles.pTool}`}>tool</span>
                <span className={styles.pCode}>send_email(to: team@company.com, attach: report.pdf)</span>
              </div>
              <div className={styles.pLine}>
                <span className={`${styles.pTag} ${styles.pDone}`}>done</span>
                <span>Report sent to 8 team members — 340ms</span>
              </div>
              <div className={styles.pCursor} />
            </div>
          </div>
        </div>
      </section>

      {/* ══════ TRUSTED BY (Dark Section) ══════ */}
      <section className={styles.darkSection}>
        <div className={styles.trustedHeader}>
          <h2>Trusted by teams shipping AI to production</h2>
        </div>
        <div className={styles.marqueeWrap}>
          <div className={styles.marquee}>
            {['OpenAI', 'Anthropic', 'LangChain', 'Vercel', 'Supabase', 'Pinecone', 'Replicate', 'Hugging Face', 'Modal', 'Neon', 'OpenAI', 'Anthropic', 'LangChain', 'Vercel', 'Supabase', 'Pinecone', 'Replicate', 'Hugging Face', 'Modal', 'Neon'].map((name, i) => (
              <span key={i} className={styles.marqueeItem}>{name}</span>
            ))}
          </div>
        </div>
        <div className={styles.statsGrid}>
          <div className={styles.stat}>
            <span className={styles.statNum}><Counter end={2} suffix=".1B" /></span>
            <span className={styles.statLabel}>Tokens routed this month</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}><Counter end={340} suffix="ms" /></span>
            <span className={styles.statLabel}>Avg. full-chain latency</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}><Counter end={16} suffix="" /></span>
            <span className={styles.statLabel}>LLM providers supported</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}><Counter end={99} suffix=".99%" /></span>
            <span className={styles.statLabel}>Tool execution success</span>
          </div>
        </div>
      </section>

      {/* ══════ PRODUCT SHOWCASE (Alternating) ══════ */}
      <section className={styles.showcase}>
        <div className={styles.showcaseRow}>
          <div className={styles.showcaseText}>
            <span className={styles.showcaseChip}><Brain size={13} /> Neural Hub</span>
            <h2>One agent.<br />Infinite tools.</h2>
            <p>Your AI sits at the center, intelligently routing requests to any connected MCP server — Gmail, Postgres, Stripe, custom APIs.</p>
            <button className={styles.showcaseLink} onClick={onGetStarted}>
              Explore integrations <ChevronRight size={14} />
            </button>
          </div>
          <div className={styles.showcaseVisual}>
            <div className={styles.hubVisual}>
              <div className={styles.hubCenter}><Bot size={24} /><span className={styles.hubPulse} /></div>
              {[
                { icon: Mail, label: 'Email' },
                { icon: Database, label: 'DB' },
                { icon: Cloud, label: 'API' },
                { icon: FileText, label: 'Files' },
                { icon: Search, label: 'Search' },
                { icon: Users, label: 'Social' },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className={styles.hubNode} style={{ '--i': i, '--total': 6 }}>
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </div>
                )
              })}
              <div className={styles.hubRing} />
              <div className={styles.hubRing2} />
            </div>
          </div>
        </div>
      </section>

      {/* ══════ DARK FEATURE SECTION ══════ */}
      <section className={styles.darkSection}>
        <div className={styles.featureDark}>
          <div className={styles.featureDarkVisual}>
            <div className={styles.flowDemo}>
              {[
                { icon: MessageSquare, label: 'Input', text: '"Send welcome emails to new signups"' },
                { icon: Brain, label: 'Think', text: 'Need: user list + email tool' },
                { icon: Database, label: 'Query', text: 'get_new_users(days: 7)' },
                { icon: Mail, label: 'Execute', text: 'send_bulk_email(users, template)' },
                { icon: Check, label: 'Done', text: '23 emails sent — 1.2s' },
              ].map((step, i) => {
                const Icon = step.icon
                return (
                  <div key={i} className={styles.flowItem}>
                    <div className={styles.flowIcon}><Icon size={14} /></div>
                    <div className={styles.flowContent}>
                      <strong>{step.label}</strong>
                      <span>{step.text}</span>
                    </div>
                    {i < 4 && <div className={styles.flowConn} />}
                  </div>
                )
              })}
            </div>
          </div>
          <div className={styles.featureDarkText}>
            <span className={styles.showcaseChipDark}><Activity size={13} /> Live Flow</span>
            <h2>Watch your AI think.</h2>
            <p>Full visibility into every decision. See reasoning, tool selection, execution — all streamed token-by-token in real-time.</p>
            <div className={styles.featureList}>
              {['Real-time SSE streaming', 'Tool chain visualization', 'Error recovery logs', 'Execution timeline'].map((f, i) => (
                <div key={i} className={styles.featureItem}>
                  <Check size={14} /> {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section className={styles.howSection}>
        <div className={styles.howHeader}>
          <span className={styles.showcaseChip}><Workflow size={13} /> How it works</span>
          <h2>From zero to AI automation</h2>
        </div>
        <div className={styles.howCards}>
          {[
            { num: '01', icon: Server, title: 'Connect', desc: 'Add your MCP server URL. We auto-discover tools and schemas instantly.' },
            { num: '02', icon: MessageSquare, title: 'Chat', desc: 'Ask your agent anything in natural language. It picks the right tools.' },
            { num: '03', icon: Gauge, title: 'Execute', desc: 'Watch tool calls stream in real-time with full transparency.' },
          ].map((s, i) => {
            const Icon = s.icon
            return (
              <div key={i} className={styles.howCard}>
                <div className={styles.howCardNum}>{s.num}</div>
                <div className={styles.howCardIcon}><Icon size={24} /></div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ══════ CTA (Dark) ══════ */}
      <section className={styles.ctaDark}>
        <div className={styles.ctaGlow} />
        <h2>Start building with<br />AI tools today.</h2>
        <p>Free forever. No credit card. Deploy in under 2 minutes.</p>
        <div className={styles.ctaBtns}>
          <button className={styles.ctaBtn} onClick={onGetStarted}>
            Get started <ArrowRight size={15} />
          </button>
          <button className={styles.ctaBtnGhost} onClick={onSignIn}>
            Sign in to dashboard
          </button>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.logo}><Bot size={16} /></div>
            <span className={styles.logoText}>ToolChain<span>AI</span></span>
          </div>
          <div className={styles.footerLinks}>
            <span>Features</span>
            <span>Docs</span>
            <span>Pricing</span>
            <span>Blog</span>
          </div>
          <span className={styles.footerCopy}>© 2026 ToolChain AI. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
