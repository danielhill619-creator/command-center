import { useState, useEffect, useRef } from 'react'
import styles from './NewsReel.module.css'

const RSS2JSON = 'https://api.rss2json.com/v1/api.json'

const FEEDS = [
  'https://feeds.bbci.co.uk/news/rss.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
]

const DEFAULT_COUNT = 5

async function fetchFeed(url) {
  const res = await fetch(`${RSS2JSON}?rss_url=${encodeURIComponent(url)}&count=10`)
  const data = await res.json()
  return (data.items ?? []).map(item => ({
    title:     item.title,
    link:      item.link,
    pub:       item.pubDate,
    thumbnail: item.thumbnail || item.enclosure?.link || null,
  }))
}

export default function NewsReel() {
  const [headlines, setHeadlines] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)
  const [expanded, setExpanded]   = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const results = await Promise.allSettled(FEEDS.map(fetchFeed))
        const all = results
          .filter(r => r.status === 'fulfilled')
          .flatMap(r => r.value)
          .slice(0, 20)
        setHeadlines(all)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll only when collapsed (expanded = user-controlled)
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

  const visible  = expanded ? headlines : headlines.slice(0, DEFAULT_COUNT)
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

      {!loading && !error && (
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
                </div>
              </a>
            ))}
          </div>

          {headlines.length > DEFAULT_COUNT && (
            <button
              className={styles.expandBtn}
              onClick={() => setExpanded(e => !e)}
            >
              {expanded
                ? '▲ SHOW LESS'
                : `▼ +${hiddenCount} MORE STORIES`
              }
            </button>
          )}
        </>
      )}
    </div>
  )
}
