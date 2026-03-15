import { useState, useEffect } from 'react'
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
  const [clock, setClock] = useState('')

  useEffect(() => {
    function tick() {
      const now = new Date()
      const h = String(now.getUTCHours()).padStart(2, '0')
      const m = String(now.getUTCMinutes()).padStart(2, '0')
      const s = String(now.getUTCSeconds()).padStart(2, '0')
      setClock(`${h}:${m}:${s} UTC`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  async function handleSignOut() {
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.container}>

      {/* ── Background layers (z-index 0) ── */}
      <div className={styles.starsFar}  aria-hidden="true" />
      <div className={styles.starsMid}  aria-hidden="true" />
      <div className={styles.starsNear} aria-hidden="true" />
      <div className={styles.nebula}    aria-hidden="true" />
      <div className={styles.grid}      aria-hidden="true" />

      {/* ── Screen overlay effects (z-index 100, pointer-events none) ── */}
      <div className={styles.vignette}  aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.headerLeft}>
            <span className={styles.logoIcon}>⬡</span>
            <div className={styles.logoBlock}>
              <span className={styles.logoText}>COMMAND CENTER</span>
              <span className={styles.logoSub}>PERSONAL OPS STATION</span>
            </div>
          </div>

          <div className={styles.headerCenter}>
            <span className={styles.hDivider} />
            <div className={styles.statusGroup}>
              <span className={styles.pulseDot} />
              <span className={styles.statusLabel}>ALL SYSTEMS ONLINE</span>
            </div>
            <span className={styles.hDivider} />
          </div>

          <div className={styles.headerRight}>
            {sheetsReady
              ? <span className={styles.sheetStatus}>◈ SHEETS ONLINE</span>
              : <span className={styles.sheetStatusOff}>◈ CONNECTING...</span>
            }
            <span className={styles.userEmail}>{user?.email}</span>
            <button className={styles.signOutBtn} onClick={handleSignOut}>
              SIGN OUT
            </button>
          </div>
        </div>

        {/* Telemetry strip */}
        <div className={styles.telemetry}>
          <span>LAT 29.7604°N</span>
          <span className={styles.telDivider}>|</span>
          <span>LON 95.3698°W</span>
          <span className={styles.telDivider}>|</span>
          <span>ALT 408 KM</span>
          <span className={styles.telDivider}>|</span>
          <span>ORBIT NOMINAL</span>
          <span className={styles.telDivider}>|</span>
          <span>SECTOR 7-G</span>
          <span className={styles.telDivider}>|</span>
          <span className={styles.telClock}>{clock}</span>
        </div>
      </header>

      {/* Quick Stats Bar */}
      <div className={styles.statsBar}>
        <QuickStats />
      </div>

      {/* Main dashboard */}
      <main className={styles.main}>
        <div className={styles.hudFrame}>
          {/* HUD corner brackets */}
          <div className={styles.cornerTL} aria-hidden="true" />
          <div className={styles.cornerTR} aria-hidden="true" />
          <div className={styles.cornerBL} aria-hidden="true" />
          <div className={styles.cornerBR} aria-hidden="true" />

          {/* Top row: System Monitor | Weather | News Reel */}
          <div className={styles.topRow}>
            <div className={styles.colNarrow}>
              <div className={styles.panelWrap}>
                <SystemMonitor />
                <div className={styles.panelScan} aria-hidden="true" />
              </div>
            </div>
            <div className={styles.colNarrow}>
              <div className={styles.panelWrap}>
                <Weather />
                <div className={styles.panelScan} aria-hidden="true" />
              </div>
            </div>
            <div className={styles.colWide}>
              <div className={styles.panelWrap}>
                <NewsReel />
                <div className={styles.panelScan} aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Middle row: Gemini Briefing | Portal Grid */}
          <div className={styles.midRow}>
            <div className={styles.colGemini}>
              <div className={styles.panelWrap}>
                <GeminiPanel />
                <div className={styles.panelScan} aria-hidden="true" />
              </div>
            </div>
            <div className={styles.colPortals}>
              <div className={styles.portalSectionLabel}>
                <span className={styles.portalLabelLine} />
                WORLDS
                <span className={styles.portalLabelLine} />
              </div>
              <div className={styles.portalGrid}>
                {PORTALS.map((portal) => (
                  <button
                    key={portal.id}
                    className={styles.portalCard}
                    style={{ '--portal-color': portal.color }}
                    onClick={() => navigate(portal.path)}
                  >
                    <div className={styles.portalCornerTL} aria-hidden="true" />
                    <div className={styles.portalCornerBR} aria-hidden="true" />
                    <span className={styles.portalIcon}>{portal.icon}</span>
                    <span className={styles.portalLabel}>{portal.label}</span>
                    <div className={styles.portalGlow} aria-hidden="true" />
                    <div className={styles.portalScanline} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <FloatingChat world="homebase" />
    </div>
  )
}
