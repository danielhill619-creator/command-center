import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../../firebase'
import { useAuth } from '../../shared/hooks/useAuth'
import { MailCenterProvider } from '../../shared/hooks/useMailCenter'
import HomeDashboard from './HomeDashboard'
import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import styles from './HomeBase.module.css'

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
            <button className={styles.settingsBtn} onClick={() => navigate('/settings')}>
              SETTINGS
            </button>
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

      {/* Main dashboard */}
      <main className={styles.main}>
        <MailCenterProvider>
          <div className={styles.hudFrame}>
            {/* HUD corner brackets */}
            <div className={styles.cornerTL} aria-hidden="true" />
            <div className={styles.cornerTR} aria-hidden="true" />
            <div className={styles.cornerBL} aria-hidden="true" />
            <div className={styles.cornerBR} aria-hidden="true" />

            <HomeDashboard />
          </div>

          <FloatingChat world="homebase" />
        </MailCenterProvider>
      </main>
    </div>
  )
}
