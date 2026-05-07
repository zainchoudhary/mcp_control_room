import {
  Server, MessageSquare, Plug, Plus,
  Activity, Sparkles, Bot, ChevronRight, TrendingUp,
  Zap, ArrowRight, Brain, Gauge, Shield, Lightbulb, Rocket,
} from 'lucide-react'
import { useMemo, useState, useEffect, useRef } from 'react'
import styles from './DashboardPage.module.css'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}


function AnimatedCounter({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const start = prevRef.current
    const end = value
    if (start === end) return
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      if (progress < 1) requestAnimationFrame(tick)
      else prevRef.current = end
    }
    requestAnimationFrame(tick)
  }, [value, duration])

  return <span>{display}</span>
}

function MiniSparkline({ data, color = 'var(--accent)', gradient = true }) {
  const max = Math.max(...data) || 1
  const id = useMemo(() => `spark-${Math.random().toString(36).slice(2, 8)}`, [])
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * 100
    const y = 100 - (v / max) * 75 - 5
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `0,100 ${points} 100,100`

  return (
    <svg viewBox="0 0 100 100" className={styles.sparkline} preserveAspectRatio="none">
      {gradient && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {gradient && (
        <polygon points={areaPoints} fill={`url(#${id})`} />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BarChart({ data }) {
  const max = Math.max(...data.map((d) => d.value + d.value2)) || 1

  return (
    <div className={styles.barChart}>
      <div className={styles.barChartBody}>
        {data.map((d, idx) => (
          <div key={d.day} className={styles.barGroup} style={{ animationDelay: `${idx * 60}ms` }}>
            <div className={styles.barStack}>
              <div className={styles.barTooltip}>
                <span>{d.value} msgs</span>
                <span>{d.value2} sessions</span>
              </div>
              <div
                className={styles.bar1}
                style={{ height: `${(d.value / max) * 100}%` }}
              />
              <div
                className={styles.bar2}
                style={{ height: `${(d.value2 / max) * 100}%` }}
              />
            </div>
            <span className={styles.barLabel}>{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage({ mcps, sessions, connectedCount, onNavigate, onNewChat, onSelectSession, onOpenRegister, onSelectMcp, user, loading, weeklyStats }) {
  const disconnectedCount = mcps.length - connectedCount
  const healthPercent = mcps.length ? Math.round((connectedCount / mcps.length) * 100) : 0

  const firstName = user?.full_name?.split(' ')[0] || user?.username || 'there'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const barData = useMemo(() => {
    if (!weeklyStats?.days) {
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({ day, value: 0, value2: 0 }))
    }
    return weeklyStats.days.map((d) => ({
      day: d.day,
      value: d.messages,
      value2: d.sessions,
    }))
  }, [weeklyStats])

  const sparkMessages = useMemo(() => {
    if (!weeklyStats?.days) return [0, 0, 0, 0, 0, 0, 0]
    return weeklyStats.days.map((d) => d.messages || 0)
  }, [weeklyStats])

  const sparkSessions = useMemo(() => {
    if (!weeklyStats?.days) return [0, 0, 0, 0, 0, 0, 0]
    return weeklyStats.days.map((d) => d.sessions || 0)
  }, [weeklyStats])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonWelcome}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonSubtitle} />
        </div>
        <div className={styles.skeletonStatsGrid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skeletonStatCard}>
              <div className={styles.skeletonStatIcon} />
              <div className={styles.skeletonStatLine} />
              <div className={styles.skeletonStatLineSm} />
            </div>
          ))}
        </div>
        <div className={styles.skeletonActionsGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonActionCard} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* ══════ Welcome Banner ══════ */}
      <div className={styles.welcome}>
        <div className={styles.welcomeLeft}>
          <h1 className={styles.welcomeTitle}>
            {getGreeting()}, <span className={styles.welcomeName}>{firstName}</span>
          </h1>
          <p className={styles.welcomeSub}>
            Your AI workspace is {connectedCount > 0 ? 'active and ready' : 'waiting for connections'}. 
            {connectedCount > 0 
              ? ` ${connectedCount} server${connectedCount !== 1 ? 's' : ''} connected and processing.`
              : ' Connect an MCP server to get started.'}
          </p>
          <button className={styles.welcomeAction} onClick={onNewChat}>
            <Sparkles size={14} />
            <span>New Chat</span>
            <ArrowRight size={13} />
          </button>
        </div>
        <div className={styles.welcomeRight}>
          <div className={styles.welcomeDate}>
            <Activity size={13} />
            <span>{dateStr}</span>
          </div>
          <div className={styles.welcomeStatus}>
            <span className={`${styles.welcomeStatusDot} ${connectedCount > 0 ? styles.welcomeStatusDotOn : ''}`} />
            <span>{connectedCount > 0 ? 'Systems Online' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* ══════ Stats Grid ══════ */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.green}`}>
          <div className={styles.statTop}>
            <div className={styles.statIcon}><Server size={17} /></div>
            <span className={styles.statLabel}>MCP Servers</span>
          </div>
          <div className={styles.statValue}><AnimatedCounter value={mcps.length} /></div>
          <div className={styles.statSub}>
            {connectedCount} connected, {disconnectedCount} offline
          </div>
          <div className={styles.statSparkWrap}>
            <MiniSparkline data={sparkSessions} color="#10a37f" />
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.blue}`}>
          <div className={styles.statTop}>
            <div className={styles.statIcon}><MessageSquare size={17} /></div>
            <span className={styles.statLabel}>Messages</span>
          </div>
          <div className={styles.statValue}><AnimatedCounter value={weeklyStats?.total_messages ?? 0} /></div>
          <div className={styles.statSub}>This week</div>
          <div className={styles.statSparkWrap}>
            <MiniSparkline data={sparkMessages} color="#3b82f6" />
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.violet}`}>
          <div className={styles.statTop}>
            <div className={styles.statIcon}><Brain size={17} /></div>
            <span className={styles.statLabel}>Sessions</span>
          </div>
          <div className={styles.statValue}><AnimatedCounter value={weeklyStats?.total_sessions ?? 0} /></div>
          <div className={styles.statSub}>This week</div>
          <div className={styles.statSparkWrap}>
            <MiniSparkline data={sparkSessions} color="#8b5cf6" />
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.amber}`}>
          <div className={styles.statTop}>
            <div className={styles.statIcon}><Gauge size={17} /></div>
            <span className={styles.statLabel}>Health</span>
          </div>
          <div className={styles.statValue}><AnimatedCounter value={healthPercent} />%</div>
          <div className={styles.statSub}>{connectedCount}/{mcps.length} servers running</div>
          <div className={styles.statSparkWrap}>
            <MiniSparkline data={[healthPercent, healthPercent, healthPercent, healthPercent, healthPercent, healthPercent, healthPercent]} color="#f59e0b" />
          </div>
        </div>
      </div>

      {/* ══════ Quick Actions ══════ */}
      <div className={styles.sectionHeader}>
        <Zap size={14} />
        <span className={styles.sectionTitle}>Quick Actions</span>
      </div>
      <div className={styles.actionsGrid}>
        <button className={`${styles.actionCard} ${styles.green}`} onClick={onNewChat}>
          <div className={styles.actionIcon}><Sparkles size={18} /></div>
          <div className={styles.actionText}>
            <span className={styles.actionLabel}>New Chat</span>
            <span className={styles.actionDesc}>Start a conversation with AI</span>
          </div>
          <ChevronRight size={16} className={styles.actionArrow} />
        </button>

        <button className={`${styles.actionCard} ${styles.blue}`} onClick={() => { onNavigate('mcp-servers'); onOpenRegister() }}>
          <div className={styles.actionIcon}><Plus size={18} /></div>
          <div className={styles.actionText}>
            <span className={styles.actionLabel}>Add Server</span>
            <span className={styles.actionDesc}>Register a new MCP server</span>
          </div>
          <ChevronRight size={16} className={styles.actionArrow} />
        </button>

        <button className={`${styles.actionCard} ${styles.violet}`} onClick={() => onNavigate('mcp-servers')}>
          <div className={styles.actionIcon}><Shield size={18} /></div>
          <div className={styles.actionText}>
            <span className={styles.actionLabel}>Manage Servers</span>
            <span className={styles.actionDesc}>View and configure MCPs</span>
          </div>
          <ChevronRight size={16} className={styles.actionArrow} />
        </button>
      </div>

      {/* ══════ Activity Chart + Lists ══════ */}
      <div className={styles.sectionHeader}>
        <Activity size={14} />
        <span className={styles.sectionTitle}>Activity Overview</span>
      </div>

      <div className={styles.cardsGrid}>
        {/* Weekly Activity Chart */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderIcon}><Activity size={15} /></div>
            <span className={styles.cardTitle}>Weekly Activity</span>
            <div className={styles.chartLegend}>
              <span className={styles.legendDot1} />
              <span>Messages</span>
              <span className={styles.legendDot2} />
              <span>Sessions</span>
            </div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.chartSummaryRow}>
              <div className={styles.chartStat}>
                <span className={styles.chartStatValue}><AnimatedCounter value={weeklyStats?.total_messages ?? 0} /></span>
                <span className={styles.chartStatLabel}>Total Messages</span>
              </div>
              <div className={styles.chartStat}>
                <span className={styles.chartStatValue}><AnimatedCounter value={weeklyStats?.total_sessions ?? 0} /></span>
                <span className={styles.chartStatLabel}>Total Sessions</span>
              </div>
              <div className={styles.chartStat}>
                <div className={styles.chartStatTrend}>
                  <TrendingUp size={13} />
                  <span>{healthPercent}%</span>
                </div>
                <span className={styles.chartStatLabel}>Uptime</span>
              </div>
            </div>
            <BarChart data={barData} />
          </div>
        </div>

        {/* MCP Servers List */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderIcon}><Plug size={15} /></div>
            <span className={styles.cardTitle}>MCP Servers</span>
            <button className={styles.cardAction} onClick={() => onNavigate('mcp-servers')}>
              View All <ChevronRight size={12} />
            </button>
          </div>
          <div className={styles.cardBody}>
            {mcps.length === 0 ? (
              <div className={styles.cardEmpty}>
                <Server size={28} className={styles.emptyIcon} />
                <p>No servers registered yet</p>
                <button className={styles.emptyBtn} onClick={() => { onNavigate('mcp-servers'); onOpenRegister() }}>
                  <Plus size={13} /> Register Server
                </button>
              </div>
            ) : (
              <div className={styles.serverList}>
                {mcps.slice(0, 5).map((mcp) => (
                  <div key={mcp.id} className={styles.serverRow} onClick={() => { onNavigate('mcp-servers'); onSelectMcp && onSelectMcp(mcp) }}>
                    <div className={styles.serverIconWrap}>
                      {mcp.icon ? (
                        <img src={mcp.icon} alt="" className={styles.serverIcon} onError={(e) => { e.target.style.display = 'none' }} />
                      ) : (
                        <Server size={14} className={styles.serverIconFallback} />
                      )}
                      <span className={`${styles.serverDot} ${mcp.connected ? styles.serverDotOn : ''}`} />
                    </div>
                    <span className={styles.serverName}>{mcp.name}</span>
                    <span className={`${styles.serverBadge} ${mcp.connected ? styles.serverBadgeOn : styles.serverBadgeOff}`}>
                      {mcp.connected ? 'Active' : 'Offline'}
                    </span>
                  </div>
                ))}
                {mcps.length > 5 && <span className={styles.moreText}>+{mcps.length - 5} more servers</span>}
              </div>
            )}
          </div>
        </div>

        {/* Recent Chats */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.cardHeaderIcon} ${styles.cardHeaderIconViolet}`}><MessageSquare size={15} /></div>
            <span className={styles.cardTitle}>Recent Chats</span>
            <button className={styles.cardAction} onClick={() => onNavigate('chat')}>
              View All <ChevronRight size={12} />
            </button>
          </div>
          <div className={styles.cardBody}>
            {sessions.length === 0 ? (
              <div className={styles.cardEmpty}>
                <MessageSquare size={28} className={styles.emptyIcon} />
                <p>No conversations yet</p>
                <button className={styles.emptyBtn} onClick={onNewChat}>
                  <Sparkles size={13} /> Start Chat
                </button>
              </div>
            ) : (
              <div className={styles.chatList}>
                {sessions.slice(0, 5).map((s) => (
                  <button key={s.id} className={styles.chatRow} onClick={() => onSelectSession(s.id)}>
                    <span className={styles.chatRowDot} />
                    <span className={styles.chatRowTitle}>{s.title || 'New conversation'}</span>
                    <ChevronRight size={13} className={styles.chatRowArrow} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pro Tips / AI Insights Card */}
        <div className={styles.proCard}>
          <div className={styles.proCardGlow} />
          <div className={styles.proCardHeader}>
            <div className={styles.proCardIcon}><Rocket size={20} /></div>
            <div>
              <h3 className={styles.proCardTitle}>AI Power Tips</h3>
              <p className={styles.proCardSub}>Get more from ToolChain AI</p>
            </div>
          </div>
          <div className={styles.proTips}>
            <div className={styles.proTip}>
              <div className={styles.proTipIcon}><Lightbulb size={14} /></div>
              <div className={styles.proTipText}>
                <span className={styles.proTipLabel}>Multi-language Support</span>
                <span className={styles.proTipDesc}>Chat in English, Urdu, Hindi or mixed — AI understands all</span>
              </div>
            </div>
            <div className={styles.proTip}>
              <div className={styles.proTipIcon}><Zap size={14} /></div>
              <div className={styles.proTipText}>
                <span className={styles.proTipLabel}>Bulk Actions</span>
                <span className={styles.proTipDesc}>Say "trash all emails from X" — AI handles multi-step tasks</span>
              </div>
            </div>
            <div className={styles.proTip}>
              <div className={styles.proTipIcon}><Brain size={14} /></div>
              <div className={styles.proTipText}>
                <span className={styles.proTipLabel}>Smart Search</span>
                <span className={styles.proTipDesc}>Use Gmail syntax: "from:x@y.com", "newer_than:7d"</span>
              </div>
            </div>
          </div>
          <button className={styles.proCardBtn} onClick={onNewChat}>
            Try it now <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
