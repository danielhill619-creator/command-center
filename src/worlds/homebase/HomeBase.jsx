import { useState, useEffect } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'
import { MailCenterProvider } from '../../shared/hooks/useMailCenter'
import HomeDashboard from './HomeDashboard'
import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import styles from './HomeBase.module.css'

export default function HomeBase() {
  const { sheetsReady } = useAuth()
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

      {/* Main dashboard */}
      <main className={styles.main}>
        <div className={styles.telemetryPanel}>
          <span className={styles.logoText}>COMMAND CENTER</span>
          <span className={styles.telemetryItem}>{sheetsReady ? 'SHEETS ONLINE' : 'CONNECTING SHEETS'}</span>
          <span className={styles.telemetryItem}>LAT 29.7604°N</span>
          <span className={styles.telemetryItem}>LON 95.3698°W</span>
          <span className={styles.telemetryItem}>ALT 408 KM</span>
          <span className={styles.telemetryItem}>ORBIT NOMINAL</span>
          <span className={styles.telemetryItem}>{clock}</span>
        </div>
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
