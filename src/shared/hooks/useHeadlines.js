/**
 * useHeadlines
 *
 * Fetches a personalized set of Google News RSS feeds via rss2json.
 * Module-level cache so multiple components share one fetch.
 */

import { useState, useEffect } from 'react'
import { buildNewsFeeds, getNewsPreferencesCacheKey } from '../newsPreferences'

const RSS_PROXY = 'https://api.allorigins.win/raw?url='
const CACHE_TTL = 15 * 60 * 1000  // 15 minutes

// Shared across all hook instances
let _cache = null
let _cacheTime = 0
let _inflight = null   // single in-flight promise
let _cacheKey = ''

function getCachedHeadlines() {
  const cacheKey = getNewsPreferencesCacheKey()
  if (_cache && _cacheKey === cacheKey && Date.now() - _cacheTime < CACHE_TTL) {
    return _cache
  }
  return null
}

async function fetchFeed(feed) {
  const res = await fetch(`${RSS_PROXY}${encodeURIComponent(feed.url)}`)
  if (!res.ok) throw new Error(`Feed request failed for ${feed.label}`)

  const xml = await res.text()
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const parserError = doc.querySelector('parsererror')
  if (parserError) throw new Error(`Feed parse failed for ${feed.label}`)

  return [...doc.querySelectorAll('item')].slice(0, 6).map(item => ({
    title: textAt(item, 'title') || feed.label,
    link: textAt(item, 'link'),
    pub: textAt(item, 'pubDate') || new Date().toUTCString(),
    thumbnail: getThumbnail(item),
    source: textAt(item, 'source') || feed.label,
  })).filter(item => item.link)
}

function textAt(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || ''
}

function getThumbnail(item) {
  return (
    item.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url') ||
    item.querySelector('media\\:content, content')?.getAttribute('url') ||
    item.querySelector('enclosure')?.getAttribute('url') ||
    null
  )
}

async function loadAll(feeds, cacheKey) {
  if (_inflight) return _inflight
  _inflight = (async () => {
    const results = await Promise.allSettled(feeds.map(fetchFeed))
    const all = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .sort((a, b) => new Date(b.pub).getTime() - new Date(a.pub).getTime())
      .slice(0, 20)
    if (!all.length) throw new Error('No headlines available')
    _cache     = all
    _cacheTime = Date.now()
    _cacheKey  = cacheKey
    _inflight  = null
    return all
  })()
  return _inflight
}

function clearCache() {
  _cache = null
  _cacheTime = 0
  _cacheKey = ''
  _inflight = null
}

export default function useHeadlines() {
  const [headlines, setHeadlines] = useState(() => getCachedHeadlines() ?? [])
  const [loading,   setLoading]   = useState(() => !getCachedHeadlines())
  const [error,     setError]     = useState(false)

  useEffect(() => {
    async function load() {
      const feeds = buildNewsFeeds()
      const cacheKey = getNewsPreferencesCacheKey()

      if (_cache && _cacheKey === cacheKey && Date.now() - _cacheTime < CACHE_TTL) {
        setHeadlines(_cache)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(false)

      try {
        const all = await loadAll(feeds, cacheKey)
        setHeadlines(all)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    function handlePreferencesUpdate() {
      clearCache()
      load()
    }

    load()
    const id = setInterval(load, CACHE_TTL)
    window.addEventListener('cc:news-preferences-updated', handlePreferencesUpdate)
    return () => {
      clearInterval(id)
      window.removeEventListener('cc:news-preferences-updated', handlePreferencesUpdate)
    }
  }, [])

  return { headlines, loading, error }
}
