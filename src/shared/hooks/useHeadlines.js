/**
 * useHeadlines
 *
 * Fetches RSS headlines from BBC + NYT via rss2json.
 * Module-level cache — multiple components share one fetch, no double requests.
 */

import { useState, useEffect } from 'react'

const RSS2JSON = 'https://api.rss2json.com/v1/api.json'
const FEEDS = [
  'https://feeds.bbci.co.uk/news/rss.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
]
const CACHE_TTL = 15 * 60 * 1000  // 15 minutes

// Shared across all hook instances
let _cache = null
let _cacheTime = 0
let _inflight = null   // single in-flight promise

async function fetchFeed(url) {
  const res  = await fetch(`${RSS2JSON}?rss_url=${encodeURIComponent(url)}&count=10`)
  const data = await res.json()
  return (data.items ?? []).map(item => ({
    title:     item.title,
    link:      item.link,
    pub:       item.pubDate,
    thumbnail: item.thumbnail || item.enclosure?.link || null,
  }))
}

async function loadAll() {
  if (_inflight) return _inflight
  _inflight = (async () => {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed))
    const all = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .slice(0, 20)
    _cache     = all
    _cacheTime = Date.now()
    _inflight  = null
    return all
  })()
  return _inflight
}

export default function useHeadlines() {
  const [headlines, setHeadlines] = useState(_cache ?? [])
  const [loading,   setLoading]   = useState(!_cache)
  const [error,     setError]     = useState(false)

  useEffect(() => {
    async function load() {
      if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
        setHeadlines(_cache)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const all = await loadAll()
        setHeadlines(all)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
    const id = setInterval(load, CACHE_TTL)
    return () => clearInterval(id)
  }, [])

  return { headlines, loading, error }
}
