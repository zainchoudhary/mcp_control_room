import { useState, useEffect, useCallback, useMemo } from 'react'
import { getSubscription, createCheckout } from '../api.js'
import {
  Crown, Zap, Building2, Check, X as XMark,
  Shield, Rocket, Loader2, ArrowLeft, Bot, Star,
  Server, MessageSquare, Layers, Headphones,
  Code, KeyRound, TrendingUp, Users,
} from 'lucide-react'
import styles from './PricingPage.module.css'

const PLAN_COLORS = {
  free: '#6366f1',
  pro: 'var(--accent, #00c896)',
  enterprise: '#f59e0b',
}

export function PricingPage({ user, addToast, onNavigate, onBack, onBrandClick, t: tProp }) {
  const t = tProp || ((k) => k)

  const PLANS = useMemo(() => [
    {
      id: 'free',
      name: t('planFree'),
      subtitle: t('freeSubtitle'),
      monthly: 0,
      yearly: 0,
      popular: false,
      color: '#6366f1',
      features: [
        t('feat2Mcp'),
        t('feat25Msg'),
        t('feat5Sessions'),
        t('featBasicAgent'),
        t('featCommSupport'),
      ],
      cta: t('currentPlan'),
    },
    {
      id: 'pro',
      name: t('planPro'),
      subtitle: t('proSubtitle'),
      monthly: 10,
      yearly: 96,
      popular: true,
      color: 'var(--accent, #00c896)',
      prevPlan: t('planFree'),
      features: [
        t('feat10Mcp'),
        t('feat500Msg'),
        t('feat50Sessions'),
        t('featAdvAgent'),
        t('featPrioSupport'),
        t('featExecHistory'),
      ],
      cta: t('upgradeToPro'),
    },
    {
      id: 'enterprise',
      name: t('planEnterprise'),
      subtitle: t('enterpriseSubtitle'),
      monthly: 30,
      yearly: 288,
      popular: false,
      color: '#f59e0b',
      prevPlan: t('planPro'),
      features: [
        t('featUnlimitedMcp'),
        t('featUnlimitedMsg'),
        t('featUnlimitedSessions'),
        t('featPremAgent'),
        t('featDedSupport'),
        t('featApiAccess'),
        t('featTeamMgmt'),
      ],
      cta: t('upgradeToEnterprise'),
    },
  ], [t])

  const COMPARE = useMemo(() => [
    { label: t('cmpMcpServers'), icon: Server, free: '2', pro: '10', ent: t('cmpUnlimited') },
    { label: t('cmpMsgDay'), icon: MessageSquare, free: '25', pro: '500', ent: t('cmpUnlimited') },
    { label: t('cmpSessionMonth'), icon: Layers, free: '5', pro: '50', ent: t('cmpUnlimited') },
    { label: t('cmpAiAgent'), icon: Bot, free: t('cmpBasic'), pro: t('cmpAdvanced'), ent: t('cmpPremium') },
    { label: t('cmpToolExec'), icon: Code, free: false, pro: true, ent: true },
    { label: t('cmpExecHistory'), icon: TrendingUp, free: false, pro: true, ent: true },
    { label: t('cmpPrioSupport'), icon: Headphones, free: false, pro: true, ent: true },
    { label: t('cmpCustomInt'), icon: KeyRound, free: false, pro: false, ent: true },
    { label: t('cmpApiAccess'), icon: Shield, free: false, pro: false, ent: true },
    { label: t('cmpDedSupport'), icon: Users, free: false, pro: false, ent: true },
  ], [t])
  const isGuest = !user
  const [subscription, setSubscription] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const [billing, setBilling] = useState('monthly')

  useEffect(() => {
    if (!isGuest) getSubscription().then(setSubscription).catch(() => {})
  }, [isGuest])

  const handleSubscribe = useCallback(async (planId) => {
    if (planId === 'free' && !isGuest) return
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

  return (
    <div className={styles.page}>

      {/* ── Top Nav ── */}
      <nav className={styles.topNav}>
        <div className={styles.brand} onClick={onBrandClick} style={{ cursor: 'pointer' }}>
          <div className={styles.brandIcon}><Bot size={16} /></div>
          <span className={styles.brandName}>ToolChain AI</span>
        </div>
        {isGuest && (
          <div className={styles.navActions}>
            <button className={styles.navLink} onClick={() => onNavigate?.('login')}>{t('logIn')}</button>
            <button className={styles.navCta} onClick={() => onNavigate?.('login')}>{t('signUp')}</button>
          </div>
        )}
      </nav>
      <button className={styles.backBtn} onClick={onBack}>
        <ArrowLeft size={15} />
      </button>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <h1 className={styles.h1}>
          {t('pricingHeroTitle1')} <span className={styles.accent}>{t('pricingHeroTitle2')}</span>
        </h1>
        <p className={styles.subtitle}>
          {t('pricingHeroSub')}
        </p>

        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${billing === 'monthly' ? styles.toggleOn : ''}`}
            onClick={() => setBilling('monthly')}
          >{t('monthly')}</button>
          <button
            className={`${styles.toggleBtn} ${billing === 'yearly' ? styles.toggleOn : ''}`}
            onClick={() => setBilling('yearly')}
          >
            {t('annual')}
            <span className={styles.badge}>-20%</span>
          </button>
        </div>
      </section>

      {/* ── Cards ── */}
      <section className={styles.cards}>
        {PLANS.map((plan) => {
          const isCurrent = !isGuest && currentPlan === plan.id
          const isUpgrade = isGuest || (planRank[plan.id] ?? 0) > (planRank[currentPlan] ?? 0)
          const isDowngrade = !isGuest && !isCurrent && !isUpgrade
          const price = billing === 'yearly' ? plan.yearly : plan.monthly
          const perMonth = billing === 'yearly' && plan.yearly > 0
            ? Math.round(plan.yearly / 12)
            : null

          let btnLabel = plan.cta
          if (isGuest) btnLabel = plan.id === 'free' ? t('getStarted') : t('getPlan').replace('${name}', plan.name)
          if (isCurrent) btnLabel = t('currentPlan')
          if (isDowngrade) btnLabel = t('downgrade')

          return (
            <div
              key={plan.id}
              className={`${styles.card} ${plan.popular ? styles.pop : ''} ${isCurrent ? styles.current : ''}`}
              style={{ '--pcolor': plan.color }}
            >
              {plan.popular && <div className={styles.ribbon}><Star size={9} /> {t('mostPopular')}</div>}

              <h3 className={styles.planName}>{plan.name}</h3>
              <p className={styles.planSub}>{plan.subtitle}</p>

              <div className={styles.priceRow}>
                <span className={styles.priceCurrency}>$</span>
                <span className={styles.priceMain}>{perMonth || price}</span>
                <span className={styles.pricePer}>{t('perMonth')}</span>
              </div>
              {perMonth && <p className={styles.billedNote}>{t('billedAnnually').replace('${price}', price)}</p>}
              {price === 0 && <p className={styles.billedNote}>{t('noCreditCard')}</p>}

              <button
                className={`${styles.cta} ${plan.popular && isUpgrade ? styles.ctaPrimary : ''} ${isCurrent ? styles.ctaCurrent : ''} ${isDowngrade ? styles.ctaDown : ''}`}
                onClick={() => handleSubscribe(plan.id)}
                disabled={isCurrent || isDowngrade || !!checkoutLoading}
              >
                {checkoutLoading === plan.id
                  ? <Loader2 size={14} className={styles.spin} />
                  : isCurrent
                    ? <Shield size={14} />
                    : isUpgrade
                      ? <Rocket size={14} />
                      : null
                }
                {btnLabel}
              </button>

              <div className={styles.divider} />

              {plan.prevPlan && (
                <p className={styles.inherits}>{t('everythingInPlan').replace('${plan}', plan.prevPlan)}</p>
              )}

              <ul className={styles.featureList}>
                {plan.features.map((f, j) => (
                  <li key={j}>
                    <Check size={14} className={styles.fCheck} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      {/* ── Comparison ── */}
      <section className={styles.compare}>
        <div className={styles.compareHeader}>
          <Layers size={18} className={styles.compareIcon} />
          <h2 className={styles.compareH2}>{t('comparePlans')}</h2>
          <p className={styles.compareSub}>{t('compareSubtitle')}</p>
        </div>
        <div className={styles.table}>
          <div className={`${styles.row} ${styles.rowHead}`}>
            <div className={styles.cellLabel}>{t('features')}</div>
            {['free', 'pro', 'enterprise'].map((pid) => {
              const PIcon = pid === 'free' ? Zap : pid === 'pro' ? Crown : Building2
              return (
                <div key={pid} className={`${styles.cellH} ${pid === 'pro' ? styles.cellHPop : ''}`}>
                  <div className={styles.colIcon} style={{ '--col-c': PLAN_COLORS[pid] }}>
                    <PIcon size={12} />
                  </div>
                  <span>{pid === 'free' ? t('planFree') : pid === 'pro' ? t('planPro') : t('planEnterprise')}</span>
                </div>
              )
            })}
          </div>
          {COMPARE.map((feat, i) => {
            const FIcon = feat.icon
            return (
              <div key={i} className={styles.row}>
                <div className={styles.cellLabel}>
                  <div className={styles.featIcon}><FIcon size={13} /></div>
                  {feat.label}
                </div>
                {['free', 'pro', 'ent'].map((col) => {
                  const v = feat[col]
                  return (
                    <div key={col} className={`${styles.cell} ${col === 'pro' ? styles.cellPop : ''}`}>
                      {v === true ? <div className={styles.checkWrap}><Check size={14} /></div>
                        : v === false ? <div className={styles.xWrap}><XMark size={14} /></div>
                        : <span className={styles.cVal}>{v}</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Trust ── */}
      <section className={styles.trust}>
        <div className={styles.trustItem}><Shield size={16} /> {t('trustEncryption')}</div>
        <span className={styles.trustDot} />
        <div className={styles.trustItem}><Zap size={16} /> {t('trustSwitching')}</div>
        <span className={styles.trustDot} />
        <div className={styles.trustItem}><Crown size={16} /> {t('trustCancel')}</div>
      </section>
    </div>
  )
}
