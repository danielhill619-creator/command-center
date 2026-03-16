const STORAGE_KEY = 'cc_news_preferences_v1'
const BING_NEWS = 'https://www.bing.com/news/search'

export const DEFAULT_NEWS_PREFERENCES = {
  topics: [
    'AI',
    'World War 3',
    'War',
    'U.S. Top Stories',
    'Global Top Stories',
    'Atlanta Braves',
    'Atlanta Falcons',
    'Tech Releases',
    'Local LLM Releases',
    'Hollywood Corruption',
    'Global Elite Corruption',
  ],
  organizations: [
    'Reuters',
    'AP',
    'YouVersion Bible',
  ],
}

const TOPIC_QUERY_MAP = {
  'AI': 'artificial intelligence OR AI',
  'World War 3': '"World War 3" OR "WWIII"',
  'War': 'war OR conflict OR invasion',
  'Atlanta Braves': 'Atlanta Braves',
  'Atlanta Falcons': 'Atlanta Falcons',
  'Tech Releases': '(Google OR Microsoft OR Apple OR OpenAI OR Anthropic OR Meta OR Amazon OR Nvidia) (launch OR release OR announces OR unveiled) software',
  'Local LLM Releases': 'local LLM OR on-device model OR open-weight model release',
  'Hollywood Corruption': 'Hollywood corruption OR entertainment industry scandal OR studio collusion',
  'Global Elite Corruption': 'global elite corruption OR oligarch scandal OR government business collusion',
}

const ORGANIZATION_QUERY_MAP = {
  'Reuters': 'site:reuters.com',
  'AP': 'site:apnews.com OR "Associated Press"',
  'YouVersion Bible': 'YouVersion Bible',
}

function normalizeList(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => `${item || ''}`.trim()).filter(Boolean))]
}

export function getDefaultNewsPreferences() {
  return {
    topics: [...DEFAULT_NEWS_PREFERENCES.topics],
    organizations: [...DEFAULT_NEWS_PREFERENCES.organizations],
  }
}

export function loadNewsPreferences() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      topics: normalizeList(raw.topics).length ? normalizeList(raw.topics) : [...DEFAULT_NEWS_PREFERENCES.topics],
      organizations: normalizeList(raw.organizations).length ? normalizeList(raw.organizations) : [...DEFAULT_NEWS_PREFERENCES.organizations],
    }
  } catch {
    return getDefaultNewsPreferences()
  }
}

export function saveNewsPreferences(value) {
  const next = {
    topics: normalizeList(value?.topics),
    organizations: normalizeList(value?.organizations),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('cc:news-preferences-updated', { detail: next }))
  return next
}

export function resetNewsPreferences() {
  localStorage.removeItem(STORAGE_KEY)
  const next = getDefaultNewsPreferences()
  window.dispatchEvent(new CustomEvent('cc:news-preferences-updated', { detail: next }))
  return next
}

function buildSearchFeed(label, query) {
  return {
    label,
    url: `${BING_NEWS}?q=${encodeURIComponent(query)}&format=rss`,
  }
}

function buildTopicFeed(label) {
  if (label === 'U.S. Top Stories') {
    return buildSearchFeed(label, 'U.S. top stories')
  }

  if (label === 'Global Top Stories') {
    return buildSearchFeed(label, 'global top stories')
  }

  return buildSearchFeed(label, TOPIC_QUERY_MAP[label] || label)
}

function buildOrganizationFeed(label) {
  return buildSearchFeed(label, ORGANIZATION_QUERY_MAP[label] || label)
}

export function buildNewsFeeds(preferences = loadNewsPreferences()) {
  const topics = normalizeList(preferences.topics)
  const organizations = normalizeList(preferences.organizations)

  return [
    ...topics.map(buildTopicFeed),
    ...organizations.map(buildOrganizationFeed),
  ]
}

export function getNewsPreferencesCacheKey(preferences = loadNewsPreferences()) {
  return JSON.stringify(buildNewsFeeds(preferences))
}
