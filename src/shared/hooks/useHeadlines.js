/**
 * useHeadlines
 *
 * Fetches a personalized set of Google News RSS feeds via rss2json.
 * Module-level cache so multiple components share one fetch.
 */

import { useState, useEffect } from 'react'
import { buildNewsFeeds, getNewsPreferencesCacheKey } from '../newsPreferences'

const RSS2JSON = 'https://api.rss2json.com/v1/api.json'
const RSS_PROXY = 'https://api.allorigins.win/raw?url='
const MICROLINK = 'https://api.microlink.io/?url='
const CACHE_TTL  = 15 * 60 * 1000  // full re-fetch every 15 min
const POLL_INTERVAL = 3 * 60 * 1000 // check for new articles every 3 min

// Shared across all hook instances
let _cache = null
let _cacheTime = 0
let _inflight = null
let _cacheKey = ''
let _latestPubTime = 0  // newest article timestamp seen so far

function getCachedHeadlines() {
  const cacheKey = getNewsPreferencesCacheKey()
  if (_cache && _cacheKey === cacheKey && Date.now() - _cacheTime < CACHE_TTL) {
    return _cache
  }
  return null
}

async function fetchFeed(feed) {
  try {
    return await fetchFeedViaJson(feed)
  } catch {
    return fetchFeedViaXml(feed)
  }
}

async function fetchFeedViaJson(feed) {
  const res = await fetch(`${RSS2JSON}?rss_url=${encodeURIComponent(feed.url)}&count=6`)
  if (!res.ok) throw new Error(`Feed request failed for ${feed.label}`)
  const data = await res.json()
  return (data.items || []).map(item => ({
    title: item.title || feed.label,
    link: item.link,
    pub: item.pubDate || new Date().toUTCString(),
    thumbnail: item.thumbnail || item.enclosure?.link || null,
    source: item.source?.title || feed.label,
  })).filter(item => item.link)
}

async function fetchFeedViaXml(feed) {
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
      .slice(0, 40)
    const finalItems = all.length ? await hydrateHeadlines(all) : buildFallbackHeadlines(feeds)
    _cache     = finalItems
    _cacheTime = Date.now()
    _cacheKey  = cacheKey
    _latestPubTime = finalItems.length ? new Date(finalItems[0].pub).getTime() : 0
    _inflight  = null
    return finalItems
  })().catch(error => {
    _inflight = null
    throw error
  })
  return _inflight
}

// Quick poll — only fetches first feed per topic to detect new articles without full re-fetch
async function pollForNew(feeds, cacheKey) {
  if (_inflight) return null
  try {
    const sample = feeds.slice(0, 5)
    const results = await Promise.allSettled(sample.map(fetchFeed))
    const fresh = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .sort((a, b) => new Date(b.pub).getTime() - new Date(a.pub).getTime())
    if (!fresh.length) return null
    const newestTime = new Date(fresh[0].pub).getTime()
    if (newestTime <= _latestPubTime) return null  // nothing new
    // New articles found — do a full reload
    clearCache()
    return await loadAll(feeds, cacheKey)
  } catch {
    return null
  }
}

function clearCache() {
  _cache = null
  _cacheTime = 0
  _cacheKey = ''
  _inflight = null
  _latestPubTime = 0
}

function buildFallbackHeadlines(feeds) {
  return feeds.slice(0, 12).map((feed, index) => ({
    title: `Open ${feed.label} news results`,
    link: toNewsPage(feed.url),
    pub: new Date(Date.now() - index * 60_000).toUTCString(),
    thumbnail: null,
    source: feed.label,
  }))
}

function toNewsPage(url) {
  return url.replace('&format=rss', '')
}

async function hydrateHeadlines(items) {
  const enriched = await Promise.all(items.map(async item => {
    if (item.thumbnail) return item
    try {
      const res = await fetch(`${MICROLINK}${encodeURIComponent(item.link)}`)
      if (!res.ok) return withSourceFallback(item)
      const json = await res.json()
      return {
        ...item,
        thumbnail: json.data?.image?.url || json.data?.logo?.url || sourceFavicon(item.link),
        source: json.data?.publisher || item.source,
      }
    } catch {
      return withSourceFallback(item)
    }
  }))
  return enriched
}

function withSourceFallback(item) {
  return {
    ...item,
    thumbnail: sourceFavicon(item.link),
  }
}

function sourceFavicon(link) {
  try {
    const host = new URL(link).hostname
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`
  } catch {
    return null
  }
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
        setHeadlines(buildFallbackHeadlines(feeds))
        setError(false)
      } finally {
        setLoading(false)
      }
    }

    function handlePreferencesUpdate() {
      clearCache()
      load()
    }

    async function poll() {
      const feeds = buildNewsFeeds()
      const cacheKey = getNewsPreferencesCacheKey()
      const updated = await pollForNew(feeds, cacheKey)
      if (updated) setHeadlines(updated)
    }

    load()
    const fullRefreshId = setInterval(load, CACHE_TTL)
    const pollId = setInterval(poll, POLL_INTERVAL)
    window.addEventListener('cc:news-preferences-updated', handlePreferencesUpdate)
    return () => {
      clearInterval(fullRefreshId)
      clearInterval(pollId)
      window.removeEventListener('cc:news-preferences-updated', handlePreferencesUpdate)
    }
  }, [])

  return { headlines, loading, error }
}
