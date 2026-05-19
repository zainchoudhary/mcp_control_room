import { useState, useEffect, useCallback, useMemo } from 'react'
import { getPlans, getSubscription, createCheckout } from '../api.js'
import {
  Crown, Zap, Building2, Check, X as XMark,
  Sparkles, Shield, Rocket, Star, Loader2,
  Server, MessageSquare, Layers, Headphones,
  Code, KeyRound, ArrowRight, ArrowLeft, Bot, Users, TrendingUp,
} from 'lucide-react'
import styles from './PricingPage.module.css'

const PLANS = [
  {
    id: 'free', name: 'Free', tag: 'For getting started',
    monthly: 0, yearly: 0, popular: false,
    icon: Zap, color: '#6366f1',
    highlight: [
      '2 MCP servers',
      '25 messages / day',
      '5 sessions / month',
      'Basic AI agent',
      'Community support',
    ],
    cta: 'Current Plan',
  },
  {
    id: 'pro', name: 'Pro', tag: 'For power users',
    monthly: 10, yearly: 96, popular: true,
    icon: Crown, color: 'var(--accent, #00c896)',
    prevPlan: 'Free',
    highlight: [
      '10 MCP servers',
      '500 messages / day',
      '50 sessions / month',
      'Advanced AI agent',
      'Priority support',
      'Execution history',
    ],
    cta: 'Upgrade to Pro',
  },
  {
    id: 'enterprise', name: 'Enterprise', tag: 'For teams & orgs',
    monthly: 30, yearly: 288, popular: false,
    icon: Building2, color: '#f59e0b',
    prevPlan: 'Pro',
    highlight: [
      'Unlimited MCP servers',
      'Unlimited messages',
      'Unlimited sessions / month',
      'Premium AI agent',
      'Dedicated support',
      'Custom integrations',
      'Full API access',
    ],
    cta: 'Upgrade to Enterprise',
  },
]

const COMPARISON_FEATURES = [
  { label: 'MCP Servers', free: '2', pro: '10', enterprise: 'Unlimited', icon: Server },
  { label: 'Messages / Day', free: '25', pro: '500', enterprise: 'Unlimited', icon: MessageSquare },
  { label: 'Sessions / Month', free: '5', pro: '50', enterprise: 'Unlimited', icon: Layers },
  { label: 'AI Agent', free: 'Basic', pro: 'Advanced', enterprise: 'Premium', icon: Bot },
  { label: 'Tool Execution', free: false, pro: true, enterprise: true, icon: Code },
  { label: 'Execution History', free: false, pro: true, enterprise: true, icon: TrendingUp },
  { label: 'Priority Support', free: false, pro: true, enterprise: true, icon: Headphones },
  { label: 'Custom Integrations', free: false, pro: false, enterprise: true, icon: KeyRound },
  { label: 'API Access', free: false, pro: false, enterprise: true, icon: Shield },
  { label: 'Dedicated Support', free: false, pro: false, enterprise: true, icon: Users },
]

const PLAN_COLORS = {
  free: '#6366f1',
  pro: 'var(--accent, #00c896)',
  enterprise: '#f59e0b',
}

export function PricingPage({ user, addToast, onNavigate, onBack }) {
  const isGuest = !user
  const [subscription, setSubscription] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const [billing, setBilling] = useState('monthly')
  const [hoveredRow, setHoveredRow] = useState(null)

  useEffect(() => {
    if (!isGuest) getSubscription().then(setSubscription).catch(() => {})
  }, [isGuest])

  const handleSubscribe = useCallback(async (planId) => {
    if (planId === 'free') return
    if (isGuest) {
      onNavigate?.('login')
      return
    }
    setCheckoutLoading(planId)
    try {
      const { url } = await createCheckout(planId)
      if (url) window.location.href = url
    } catch (e) {
      addToast?.(`Checkout failed: ${e.message}`, 'error')
    } finally {
      setCheckoutLoading(null)
    }
  }, [addToast, isGuest, onNavigate])

  const currentPlan = subscription?.plan || user?.plan || 'free'
  const planRank = { free: 0, pro: 1, enterprise: 2 }

  const getCtaLabel = (plan) => {
    if (isGuest) return plan.id === 'free' ? 'Get Started Free' : `Get Started with ${plan.name}`
    return plan.cta
  }

  return (
    <div className={styles.page}>

      {/* ── Guest Nav Bar ── */}
      {isGuest && (
        <nav className={styles.guestNav}>
          <button className={styles.guestNavBack} onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div className={styles.guestNavBrand}>
            <Bot size={16} />
            <span>ToolChain<strong>AI</strong></span>
          </div>
          <div className={styles.guestNavActions}>
            <button className={styles.guestNavLogin} onClick={() => onNavigate?.('login')}>Log in</button>
            <button className={styles.guestNavSignup} onClick={() => onNavigate?.('login')}>Sign up</button>
          </div>
        </nav>
      )}

      {/* ── Hero ─────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <h1 className={styles.heroH1}>
          Plans that grow <span className={styles.accent}>with you</span>
        </h1>
        <p className={styles.heroP}>
          Get started for free. Upgrade when you need more power.<br />
        </p>

        {/* Billing Toggle */}
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${billing === 'monthly' ? styles.toggleActive : ''}`}
            onClick={() => setBilling('monthly')}
          >Monthly</button>
          <button
            className={`${styles.toggleBtn} ${billing === 'yearly' ? styles.toggleActive : ''}`}
            onClick={() => setBilling('yearly')}
          >
            Yearly
            <span className={styles.saveBadge}>Save 20%</span>
          </button>
        </div>
      </section>

      {/* ── Plan Cards ───────────────────── */}
      <section className={styles.cards}>
        {PLANS.map((plan, i) => {
          const Icon = plan.icon
          const isCurrent = currentPlan === plan.id
          const isUpgrade = (planRank[plan.id] ?? 0) > (planRank[currentPlan] ?? 0)
          const price = billing === 'yearly' ? plan.yearly : plan.monthly
          const perMonth = billing === 'yearly' && plan.yearly > 0
            ? (plan.yearly / 12).toFixed(0)
            : null

          return (
            <div
              key={plan.id}
              className={`${styles.card} ${plan.popular ? styles.cardPop : ''} ${isCurrent ? styles.cardCurrent : ''}`}
              style={{ '--i': i, '--plan-color': plan.color }}
            >
              {plan.popular && (
                <div className={styles.popRibbon}>
                  <Star size={10} /> Most Popular
                </div>
              )}

              <div className={styles.cardTop}>
                <div className={styles.cardIcon}>
                  <Icon size={18} />
                </div>
                <div>
                  <h3 className={styles.cardName}>{plan.name}</h3>
                  <p className={styles.cardTag}>{plan.tag}</p>
                </div>
              </div>

              <div className={styles.cardPrice}>
                {price === 0 ? (
                  <span className={styles.bigPrice}>Free</span>
                ) : (
                  <>
                    <span className={styles.dollar}>$</span>
                    <span className={styles.bigPrice}>{perMonth || price}</span>
                    <span className={styles.period}>/ mo</span>
                  </>
                )}
              </div>
              {perMonth && (
                <p className={styles.billedNote}>
                  Billed ${price} annually
                </p>
              )}
              {price === 0 && <p className={styles.billedNote}>No credit card needed</p>}

              <div className={styles.sep} />

              {plan.prevPlan && (
                <p className={styles.includes}>Everything in {plan.prevPlan}, plus:</p>
              )}

              <ul className={styles.feats}>
                {plan.highlight.map((h, j) => (
                  <li key={j}>
                    <Check size={14} className={styles.checkIcon} />
                    {h}
                  </li>
                ))}
              </ul>

              <div className={styles.cardCta}>
                {isGuest ? (
                  <button
                    className={`${styles.btn} ${plan.popular ? styles.btnPrimary : styles.btnSecondary}`}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    <Rocket size={14} />
                    {getCtaLabel(plan)}
                  </button>
                ) : isCurrent ? (
                  <button className={`${styles.btn} ${styles.btnOutline}`} disabled>
                    <Shield size={14} /> Current Plan
                  </button>
                ) : isUpgrade ? (
                  <button
                    className={`${styles.btn} ${plan.popular ? styles.btnPrimary : styles.btnSecondary}`}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!!checkoutLoading}
                  >
                    {checkoutLoading === plan.id
                      ? <Loader2 size={14} className={styles.spin} />
                      : <Rocket size={14} />
                    }
                    {plan.cta}
                  </button>
                ) : (
                  <button className={`${styles.btn} ${styles.btnSecondary}`} disabled>
                    <ArrowRight size={14} /> Downgrade
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </section>

      {/* ── Feature Comparison ────────────── */}
      <section className={styles.compSection}>
        <div className={styles.compHeader}>
          <Layers size={18} className={styles.compHIcon} />
          <h2 className={styles.compTitle}>Compare plans</h2>
          <p className={styles.compSub}>See exactly what you get with each plan</p>
        </div>

        <div className={styles.compTable}>
          {/* Column headers */}
          <div className={`${styles.compRow} ${styles.compHead}`}>
            <div className={styles.compLabel}>Features</div>
            {['free', 'pro', 'enterprise'].map((planId) => {
              const PIcon = planId === 'free' ? Zap : planId === 'pro' ? Crown : Building2
              return (
                <div key={planId} className={`${styles.compColHead} ${planId === 'pro' ? styles.compColPop : ''}`}>
                  <div className={styles.compColIcon} style={{ '--col-color': PLAN_COLORS[planId] }}>
                    <PIcon size={13} />
                  </div>
                  <span>{planId.charAt(0).toUpperCase() + planId.slice(1)}</span>
                </div>
              )
            })}
          </div>

          {/* Feature rows */}
          {COMPARISON_FEATURES.map((feat, i) => {
            const FeIcon = feat.icon
            return (
              <div
                key={i}
                className={`${styles.compRow} ${hoveredRow === i ? styles.compRowHover : ''}`}
                style={{ '--row-i': i }}
                onMouseEnter={() => setHoveredRow(i)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <div className={styles.compLabel}>
                  <div className={styles.compFeatIconWrap}>
                    <FeIcon size={13} />
                  </div>
                  {feat.label}
                </div>
                {['free', 'pro', 'enterprise'].map((planId) => {
                  const val = feat[planId]
                  return (
                    <div key={planId} className={`${styles.compCell} ${planId === 'pro' ? styles.compCellPop : ''}`}>
                      {val === true
                        ? <div className={styles.compCheckWrap}><Check size={14} /></div>
                        : val === false
                          ? <div className={styles.compXWrap}><XMark size={14} /></div>
                          : <span className={styles.compVal}>{val}</span>
                      }
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Trust Strip ───────────────────── */}
      <section className={styles.trust}>
        <div className={styles.trustItem}>
          <Shield size={18} />
          <span>Bank-level encryption</span>
        </div>
        <div className={styles.trustDot} />
        <div className={styles.trustItem}>
          <Zap size={18} />
          <span>Instant plan switching</span>
        </div>
        <div className={styles.trustDot} />
        <div className={styles.trustItem}>
          <Headphones size={18} />
          <span>Cancel anytime</span>
        </div>
      </section>

    </div>
  )
}
