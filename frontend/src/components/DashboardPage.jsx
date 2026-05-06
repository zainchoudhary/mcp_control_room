import {
  Server, MessageSquare, Plug, ArrowRight, Zap, Plus,
  Activity, Bot, Sparkles, Clock,
} from 'lucide-react'
import styles from './DashboardPage.module.css'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

export function DashboardPage({ mcps, sessions, connectedCount, onNavigate, onNewChat, onSelectSession, onOpenRegister, user, loading }) {
  const disconnectedCount = mcps.length - connectedCount
  const healthPercent = mcps.length ? Math.round((connectedCount / mcps.length) * 100) : 0

  const stats = [
    {
      label: 'MCP Servers',
      value: mcps.length,
      icon: Server,
      color: 'blue',
      sub: mcps.length === 0 ? 'None registered' : `${connectedCount} active`,
    },
    {
      label: 'Connected',
      value: connectedCount,
      icon: Plug,
      color: 'green',
      sub: disconnectedCount > 0 ? `${disconnectedCount} offline` : 'All online',
    },
    {
      label: 'Chat Sessions',
      value: sessions.length,
      icon: MessageSquare,
      color: 'violet',
      sub: sessions.length === 0 ? 'Start a conversation' : 'Total conversations',
    },
    {
      label: 'System Health',
      value: `${healthPercent}%`,
      icon: Activity,
      color: healthPercent >= 80 ? 'green' : healthPercent >= 50 ? 'amber' : 'red',
      sub: mcps.length === 0 ? 'No servers' : `${connectedCount}/${mcps.length} servers up`,
    },
  ]

  const quickActions = [
    {
      label: 'New Chat',
      desc: 'Start an AI conversation',
      icon: Sparkles,
      color: 'green',
      onClick: onNewChat,
    },
    {
      label: 'Add Server',
      desc: 'Register an MCP server',
      icon: Plus,
      color: 'blue',
      onClick: () => { onNavigate('mcp-servers'); onOpenRegister() },
    },
    {
      label: 'Manage Servers',
      desc: 'View & connect MCPs',
      icon: Server,
      color: 'violet',
      onClick: () => onNavigate('mcp-servers'),
    },
  ]

  const greeting = getGreeting()
  const firstName = user?.full_name?.split(' ')[0] || user?.username || 'there'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

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
      <div className={styles.welcome}>
        <div className={styles.welcomeLeft}>
          <h1 className={styles.welcomeTitle}>
            {greeting}, <span className={styles.welcomeName}>{firstName}</span>
          </h1>
          <p className={styles.welcomeSub}>
            {mcps.length === 0
              ? 'Get started by registering your first MCP server to unlock AI tools.'
              : `You have ${connectedCount} server${connectedCount !== 1 ? 's' : ''} connected and ready to assist you.`}
          </p>
          {mcps.length > 0 && connectedCount > 0 && (
            <button className={styles.welcomeAction} onClick={onNewChat}>
              <Sparkles size={15} />
              <span>Start Chatting</span>
            </button>
          )}
        </div>
        <div className={styles.welcomeRight}>
          <div className={styles.welcomeDate}>
            <Clock size={14} />
            <span>{dateStr}</span>
          </div>
          <div className={styles.welcomeStatus}>
            <div className={`${styles.welcomeStatusDot} ${connectedCount > 0 ? styles.welcomeStatusDotOn : ''}`} />
            <span>{connectedCount > 0 ? 'Systems Online' : 'No Servers Active'}</span>
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`${styles.statCard} ${styles[s.color]}`}>
              <div className={styles.statTop}>
                <div className={styles.statIcon}>
                  <Icon size={18} />
                </div>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statSub}>{s.sub}</span>
            </div>
          )
        })}
      </div>

      <div className={styles.sectionHeader}>
        <Zap size={16} />
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
      </div>
      <div className={styles.actionsGrid}>
        {quickActions.map((a) => {
          const Icon = a.icon
          return (
            <button
              key={a.label}
              className={`${styles.actionCard} ${styles[a.color]}`}
              onClick={a.onClick}
            >
              <div className={styles.actionIcon}>
                <Icon size={18} />
              </div>
              <div className={styles.actionText}>
                <span className={styles.actionLabel}>{a.label}</span>
                <span className={styles.actionDesc}>{a.desc}</span>
              </div>
              <ArrowRight size={14} className={styles.actionArrow} />
            </button>
          )
        })}
      </div>

      <div className={styles.cardsGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderIcon}>
              <Server size={16} />
            </div>
            <h2 className={styles.cardTitle}>MCP Servers</h2>
            <button className={styles.cardAction} onClick={() => onNavigate('mcp-servers')}>
              <span>Manage</span>
              <ArrowRight size={14} />
            </button>
          </div>
          <div className={styles.cardBody}>
            {mcps.length === 0 ? (
              <div className={styles.cardEmpty}>
                <Server size={28} className={styles.emptyIcon} />
                <p>No MCP servers registered yet</p>
                <button className={styles.emptyBtn} onClick={() => onNavigate('mcp-servers')}>
                  <Plus size={14} />
                  <span>Register Server</span>
                </button>
              </div>
            ) : (
              <div className={styles.serverList}>
                {mcps.slice(0, 5).map((mcp) => (
                  <div key={mcp.id} className={styles.serverRow}>
                    <div className={`${styles.serverDot} ${mcp.connected ? styles.serverDotOn : ''}`} />
                    <span className={styles.serverName}>{mcp.name}</span>
                    <span className={`${styles.serverBadge} ${mcp.connected ? styles.serverBadgeOn : styles.serverBadgeOff}`}>
                      {mcp.connected ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                ))}
                {mcps.length > 5 && (
                  <p className={styles.moreText}>+{mcps.length - 5} more servers</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.cardHeaderIcon} ${styles.cardHeaderIconViolet}`}>
              <MessageSquare size={16} />
            </div>
            <h2 className={styles.cardTitle}>Recent Chats</h2>
            <button className={styles.cardAction} onClick={() => onNavigate('chat')}>
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>
          <div className={styles.cardBody}>
            {sessions.length === 0 ? (
              <div className={styles.cardEmpty}>
                <MessageSquare size={28} className={styles.emptyIcon} />
                <p>No conversations yet</p>
                <button className={styles.emptyBtn} onClick={onNewChat}>
                  <Sparkles size={14} />
                  <span>Start Chatting</span>
                </button>
              </div>
            ) : (
              <div className={styles.chatList}>
                {sessions.slice(0, 5).map((s) => (
                  <button
                    key={s.id}
                    className={styles.chatRow}
                    onClick={() => onSelectSession(s.id)}
                  >
                    <div className={styles.chatRowDot} />
                    <span className={styles.chatRowTitle}>{s.title || 'New conversation'}</span>
                    <ArrowRight size={12} className={styles.chatRowArrow} />
                  </button>
                ))}
                {sessions.length > 5 && (
                  <p className={styles.moreText}>+{sessions.length - 5} more conversations</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
