import { useEffect, useRef, useState } from 'react'
import {
  Bot, Zap, ArrowRight,
  Terminal, MessageSquare, Server, Workflow,
  Mail, Search, Database, FileText, Cloud, Lock,
  Users, Brain, Gauge, Play, Check,
  Activity, Sparkles, Shield, Code, Globe, ChevronRight,
  User, Send, Loader2,
} from 'lucide-react'
import { submitContact } from '../api.js'
import styles from './LandingPage.module.css'

function useReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.unobserve(el) }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

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

export function LandingPage({ onGetStarted, onSignIn, isLoggedIn }) {
  const [trustedRef, trustedVis] = useReveal()
  const [showcaseRef, showcaseVis] = useReveal()
  const [flowRef, flowVis] = useReveal()
  const [howRef, howVis] = useReveal(0.1)
  const [ctaRef, ctaVis] = useReveal(0.2)
  const [contactRef, contactVis] = useReveal(0.1)

  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', category: 'query', message: '' })
  const [contactSending, setContactSending] = useState(false)
  const [contactResult, setContactResult] = useState(null)

  return (
    <div className={styles.page}>
      {/* ══════ NAV ══════ */}
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <div className={styles.logo}><Bot size={18} /></div>
          <span className={styles.logoText}>ToolChain<span>AI</span></span>
        </div>
        <div className={styles.navRight}>
          {isLoggedIn ? (
            <button className={styles.navCta} onClick={onGetStarted}>Go to Dashboard</button>
          ) : (
            <>
              <button className={styles.navLink} onClick={onSignIn}>Log in</button>
              <button className={styles.navCta} onClick={onGetStarted}>Get started</button>
            </>
          )}
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
            {isLoggedIn ? (
              <button className={styles.heroBtn} onClick={onGetStarted}>
                Go to Dashboard <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <button className={styles.heroBtn} onClick={onGetStarted}>
                  Get started <ArrowRight size={16} />
                </button>
                <button className={styles.heroBtnSec} onClick={onSignIn}>
                  Sign in
                </button>
              </>
            )}
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
      <section ref={trustedRef} className={`${styles.darkSection} ${trustedVis ? styles.revealed : styles.hidden}`}>
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
      <section ref={showcaseRef} className={`${styles.showcase} ${showcaseVis ? styles.revealed : styles.hidden}`}>
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
      <section ref={flowRef} className={`${styles.darkSection} ${flowVis ? styles.revealed : styles.hidden}`}>
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
      <section ref={howRef} className={`${styles.howSection} ${howVis ? styles.revealed : styles.hidden}`}>
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
      <section ref={ctaRef} className={`${styles.ctaDark} ${ctaVis ? styles.revealed : styles.hidden}`}>
        <div className={styles.ctaGlow} />
        <h2>Start building with<br />AI tools today.</h2>
        <p>Free forever. No credit card. Deploy in under 2 minutes.</p>
        <div className={styles.ctaBtns}>
          {isLoggedIn ? (
            <button className={styles.ctaBtn} onClick={onGetStarted}>
              Go to Dashboard <ArrowRight size={15} />
            </button>
          ) : (
            <>
              <button className={styles.ctaBtn} onClick={onGetStarted}>
                Get started <ArrowRight size={15} />
              </button>
              <button className={styles.ctaBtnGhost} onClick={onSignIn}>
                Sign in to dashboard
              </button>
            </>
          )}
        </div>
      </section>

      {/* ══════ CONTACT US ══════ */}
      <section ref={contactRef} className={`${styles.contactSection} ${contactVis ? styles.revealed : styles.hidden}`}>
        <div className={styles.contactGlow} />
        <div className={styles.contactGlow2} />
        <div className={styles.contactHeader}>
          <div className={styles.contactPill}><Mail size={13} /> Contact Us</div>
          <h2 className={styles.contactTitle}>Let's Start a<br />Conversation</h2>
          <p className={styles.contactSubtitle}>Have a question, complaint, or feedback? We'd love to hear from you.</p>
        </div>
        <div className={styles.contactInner}>
          <div className={styles.contactInfo}>
            <div className={styles.contactCard}>
              <div className={styles.contactCardIcon}><Mail size={20} /></div>
              <div>
                <h4>Email Us</h4>
                <p>ceo.toolchain@gmail.com</p>
              </div>
            </div>
            <div className={styles.contactCard}>
              <div className={styles.contactCardIcon}><MessageSquare size={20} /></div>
              <div>
                <h4>Response Time</h4>
                <p>Usually within 24 hours</p>
              </div>
            </div>
            <div className={styles.contactCard}>
              <div className={styles.contactCardIcon}><Shield size={20} /></div>
              <div>
                <h4>Privacy First</h4>
                <p>Your data stays safe with us</p>
              </div>
            </div>
          </div>
          <form className={styles.contactForm} onSubmit={async (e) => {
            e.preventDefault()
            setContactSending(true); setContactResult(null)
            try {
              const res = await submitContact(contactForm)
              setContactResult({ type: 'success', text: res.message })
              setContactForm({ name: '', email: '', subject: '', category: 'query', message: '' })
            } catch (err) {
              setContactResult({ type: 'error', text: err.message })
            } finally { setContactSending(false) }
          }}>
            <div className={styles.contactFormTitle}>Send us a message</div>
            <div className={styles.contactRow}>
              <div className={styles.contactField}>
                <User size={15} className={styles.contactFieldIcon} />
                <input type="text" placeholder="Your name" value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} required disabled={contactSending} />
              </div>
              <div className={styles.contactField}>
                <Mail size={15} className={styles.contactFieldIcon} />
                <input type="email" placeholder="Your email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} required disabled={contactSending} />
              </div>
            </div>
            <div className={styles.contactRow}>
              <div className={styles.contactField}>
                <FileText size={15} className={styles.contactFieldIcon} />
                <input type="text" placeholder="Subject" value={contactForm.subject} onChange={e => setContactForm(f => ({ ...f, subject: e.target.value }))} required disabled={contactSending} />
              </div>
              <div className={styles.contactField}>
                <select value={contactForm.category} onChange={e => setContactForm(f => ({ ...f, category: e.target.value }))} disabled={contactSending} className={styles.contactSelect}>
                  <option value="query">General Query</option>
                  <option value="feedback">Feedback</option>
                  <option value="complaint">Complaint</option>
                </select>
              </div>
            </div>
            <div className={styles.contactField} style={{ width: '100%' }}>
              <textarea placeholder="Write your message here..." rows={5} value={contactForm.message} onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))} required disabled={contactSending} className={styles.contactTextarea} />
            </div>
            {contactResult && (
              <div className={`${styles.contactMsg} ${contactResult.type === 'success' ? styles.contactMsgSuccess : styles.contactMsgError}`}>
                {contactResult.type === 'success' ? <Check size={14} /> : null}
                {contactResult.text}
              </div>
            )}
            <button type="submit" className={styles.contactBtn} disabled={contactSending}>
              {contactSending ? <Loader2 size={16} className={styles.contactSpinner} /> : <><Send size={15} /> Send Message</>}
            </button>
          </form>
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
            <span onClick={() => showcaseRef.current?.scrollIntoView({ behavior: 'smooth' })}>Features</span>
            <span onClick={() => howRef.current?.scrollIntoView({ behavior: 'smooth' })}>How it Works</span>
            <span onClick={() => contactRef.current?.scrollIntoView({ behavior: 'smooth' })}>Contact</span>
          </div>
          <span className={styles.footerCopy}>© 2026 ToolChain AI. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
