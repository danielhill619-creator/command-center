import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../../firebase'
import { useAuth } from '../../shared/hooks/useAuth'
import SystemMonitor from '../../widgets/sysmonitor/SystemMonitor'
import Weather from '../../widgets/weather/Weather'
import NewsReel from '../../widgets/newsreel/NewsReel'
import GeminiPanel from '../../widgets/gemini-panel/GeminiPanel'
import QuickStats from '../../widgets/quickstats/QuickStats'
import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import styles from './HomeBase.module.css'

const PORTALS = [
  { id: 'work',      label: 'Work',      path: '/work',      icon: '◈', color: '#00c8ff' },
  { id: 'school',    label: 'School',    path: '/school',    icon: '◉', color: '#ff2d8a' },
  { id: 'home',      label: 'Home',      path: '/home',      icon: '⬡', color: '#4caf50' },
  { id: 'fun',       label: 'Fun',       path: '/fun',       icon: '★', color: '#ffd600' },
  { id: 'spiritual', label: 'Spiritual', path: '/spiritual', icon: '✦', color: '#c9a84c' },
]

export default function HomeBase() {
  const { user, sheetsReady } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.container}>
      <div className={styles.stars} aria-hidden="true" />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>COMMAND CENTER</span>
        </div>
        <div className={styles.headerRight}>
          {sheetsReady
            ? <span className={styles.sheetStatus}>SHEETS ONLINE</span>
            : <span className={styles.sheetStatusOff}>CONNECTING...</span>
          }
          <span className={styles.userEmail}>{user?.email}</span>
          <button className={styles.signOutBtn} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Quick Stats Bar */}
      <div className={styles.statsBar}>
        <QuickStats />
      </div>

      {/* Main dashboard */}
      <main className={styles.main}>

        {/* Top row: System Monitor | Weather | News Reel */}
        <div className={styles.topRow}>
          <div className={styles.colNarrow}>
            <SystemMonitor />
          </div>
          <div className={styles.colNarrow}>
            <Weather />
          </div>
          <div className={styles.colWide}>
            <NewsReel />
          </div>
        </div>

        {/* Middle row: Gemini Briefing | Portal Grid */}
        <div className={styles.midRow}>
          <div className={styles.colGemini}>
            <GeminiPanel />
          </div>
          <div className={styles.colPortals}>
            <div className={styles.portalSectionLabel}>WORLDS</div>
            <div className={styles.portalGrid}>
              {PORTALS.map((portal) => (
                <button
                  key={portal.id}
                  className={styles.portalCard}
                  style={{ '--portal-color': portal.color }}
                  onClick={() => navigate(portal.path)}
                >
                  <span className={styles.portalIcon}>{portal.icon}</span>
                  <span className={styles.portalLabel}>{portal.label}</span>
                  <div className={styles.portalGlow} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>

      </main>
      <FloatingChat world="homebase" />
    </div>
  )
}
