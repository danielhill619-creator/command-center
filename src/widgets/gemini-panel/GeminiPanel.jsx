import { useGemini } from '../../shared/hooks/useGemini'
import styles from './GeminiPanel.module.css'

export default function GeminiPanel() {
  const { briefing, briefingLoading, triggerBriefing, ready } = useGemini('homebase')

  // Format the briefing text — split on bullet markers for clean rendering
  const lines = briefing
    ? briefing.split('\n').filter(l => l.trim())
    : []

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.icon}>✦</span>
        <span className={styles.label}>GEMINI BRIEFING</span>
        <div className={styles.headerRight}>
          {briefingLoading && <span className={styles.thinking}>THINKING...</span>}
          <button
            className={styles.refreshBtn}
            onClick={triggerBriefing}
            disabled={briefingLoading || !ready}
            title="Refresh briefing"
          >
            ↻
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {briefingLoading && !briefing && (
          <div className={styles.loadingState}>
            <span className={styles.pulse} />
            <span className={styles.loadingText}>GENERATING MORNING BRIEFING...</span>
          </div>
        )}

        {!briefingLoading && !briefing && !ready && (
          <div className={styles.placeholder}>
            Connecting to data layer...
          </div>
        )}

        {!briefingLoading && !briefing && ready && (
          <div className={styles.placeholder}>
            No briefing yet today.{' '}
            <button className={styles.triggerLink} onClick={triggerBriefing}>
              Generate now
            </button>
          </div>
        )}

        {briefing && (
          <div className={styles.briefingContent}>
            {lines.map((line, i) => {
              const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)
              const text = line.replace(/^[•\-*]\s*/, '').replace(/^\d+\.\s*/, '')
              const isBold = line.startsWith('**') || line.startsWith('###') || line.startsWith('##')
              const cleanText = text.replace(/\*\*/g, '').replace(/^#+\s*/, '')
              return isBold
                ? <p key={i} className={styles.briefingHeading}>{cleanText}</p>
                : isBullet
                  ? <p key={i} className={styles.briefingBullet}><span className={styles.bullet}>▸</span>{cleanText}</p>
                  : <p key={i} className={styles.briefingText}>{cleanText}</p>
            })}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.status}>
          {ready ? 'GEMINI 2.5 FLASH • ONLINE' : 'OFFLINE'}
        </span>
      </div>
    </div>
  )
}
