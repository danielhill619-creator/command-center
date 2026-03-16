import { useState, useEffect, useRef } from 'react'
import useHeadlines from '../../shared/hooks/useHeadlines'
import styles from './NewsReel.module.css'

const DEFAULT_COUNT = 5

export default function NewsReel() {
  const { headlines, loading, error } = useHeadlines()
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef(null)

  // Auto-scroll only when collapsed
  useEffect(() => {
    if (!scrollRef.current || headlines.length === 0 || expanded) return
    const el = scrollRef.current
    let pos = 0
    const id = setInterval(() => {
      pos += 0.4
      if (pos >= el.scrollHeight - el.clientHeight) pos = 0
      el.scrollTop = pos
    }, 40)
    return () => clearInterval(id)
  }, [headlines, expanded])

  const visible     = expanded ? headlines : headlines.slice(0, DEFAULT_COUNT)
  const hiddenCount = headlines.length - DEFAULT_COUNT

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.label}>INCOMING FEED</span>
        <span className={styles.dot} />
        <span className={styles.live}>LIVE</span>
      </div>

      {loading && <div className={styles.status}>ACQUIRING SIGNAL...</div>}
      {error   && <div className={styles.status}>FEED UNAVAILABLE</div>}
      {!loading && !error && headlines.length === 0 && <div className={styles.status}>NO STORIES FOUND</div>}

      {!loading && !error && headlines.length > 0 && (
        <>
          <div
            className={`${styles.scroll} ${expanded ? styles.scrollExpanded : ''}`}
            ref={scrollRef}
          >
            {visible.map((h, i) => (
              <a
                key={i}
                className={styles.item}
                href={h.link}
                target="_blank"
                rel="noreferrer"
              >
                {h.thumbnail
                  ? <img src={h.thumbnail} alt="" className={styles.thumb} />
                  : <div className={styles.thumbPlaceholder} />
                }
                <div className={styles.itemBody}>
                  <span className={styles.ticker}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={styles.title}>{h.title}</span>
                  <span className={styles.meta}>{h.source || 'Google News'}</span>
                </div>
              </a>
            ))}
          </div>

          {headlines.length > DEFAULT_COUNT && (
            <button
              className={styles.expandBtn}
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? '▲ SHOW LESS' : `▼ +${hiddenCount} MORE STORIES`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
