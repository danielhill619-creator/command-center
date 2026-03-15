import styles from './GeminiPanel.module.css'

export default function GeminiPanel() {
  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.icon}>◈</span>
        <span className={styles.label}>GEMINI — DAILY BRIEFING</span>
      </div>
      <div className={styles.body}>
        <p className={styles.placeholder}>
          AI briefing active in Phase 4. Gemini will summarize your day here
          — open tasks, upcoming deadlines, bills due, and a morning message.
        </p>
      </div>
      <div className={styles.footer}>
        <span className={styles.status}>OFFLINE — PHASE 4</span>
      </div>
    </div>
  )
}
