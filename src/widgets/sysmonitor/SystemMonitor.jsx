import { useState, useEffect } from 'react'
import styles from './SystemMonitor.module.css'

function pad(n) { return String(n).padStart(2, '0') }

function getUptime(loginTime) {
  const diff = Math.floor((Date.now() - loginTime) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

const SESSION_START = Date.now()

export default function SystemMonitor() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  })

  return (
    <div className={styles.widget}>
      <div className={styles.label}>SYSTEM CLOCK</div>
      <div className={styles.time}>{timeStr}</div>
      <div className={styles.date}>{dateStr}</div>
      <div className={styles.divider} />
      <div className={styles.row}>
        <span className={styles.key}>SESSION</span>
        <span className={styles.val}>{getUptime(SESSION_START)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.key}>STATUS</span>
        <span className={styles.online}>ONLINE</span>
      </div>
    </div>
  )
}
