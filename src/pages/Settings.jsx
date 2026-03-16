import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../shared/hooks/useAuth'
import { getEmailState } from '../integrations/email/emailService'
import { getAppManifest } from '../integrations/gemini-api/appContext'
import {
  getGeminiUsageStats,
  getSelectedGeminiModel,
  listAvailableGeminiModels,
  setSelectedGeminiModel,
  subscribeToGeminiUsage,
} from '../integrations/gemini-api/geminiService'
import {
  loadNewsPreferences,
  resetNewsPreferences,
  saveNewsPreferences,
} from '../shared/newsPreferences'
import styles from './Settings.module.css'

const HOME_LAYOUT_KEY = 'cc_home_dashboard_layout_v1'
const SHEET_IDS_KEY = 'cc_sheet_ids'
const REPO_URL_KEY = 'cc_repo_url_v1'
const GEMINI_USAGE_URL = 'https://aistudio.google.com/app/apikey'

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

function inferAvailability(stats) {
  const error = `${stats?.lastError || ''}`.toLowerCase()
  if (error.includes('quota') || error.includes('429')) return 'Exhausted'
  if (stats?.requests > 0) return 'Available'
  return 'Unknown'
}

function formatFollowList(items) {
  return items.join('\n')
}

function parseFollowList(value) {
  return [...new Set(value.split(/[\n,]/).map(item => item.trim()).filter(Boolean))]
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, sheetsReady, sheetIds } = useAuth()
  const [newsPreferences, setNewsPreferences] = useState(() => loadNewsPreferences())
  const [repoUrl, setRepoUrl] = useState(() => localStorage.getItem(REPO_URL_KEY) || '')
  const [selectedModel, setSelectedModelState] = useState(() => getSelectedGeminiModel())
  const [models, setModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState('')
  const [usageStats, setUsageStats] = useState(() => getGeminiUsageStats())
  const [emailState, setEmailState] = useState({ accounts: [], folders: {} })
  const [emailError, setEmailError] = useState('')
  const [newsTopicsText, setNewsTopicsText] = useState(() => formatFollowList(loadNewsPreferences().topics))
  const [newsOrganizationsText, setNewsOrganizationsText] = useState(() => formatFollowList(loadNewsPreferences().organizations))
  const [newsSavedNotice, setNewsSavedNotice] = useState('')

  const manifest = useMemo(() => getAppManifest(), [])
  useEffect(() => {
    async function load() {
      setModelsLoading(true)
      setModelsError('')
      setEmailError('')
      try {
        const [availableModels, mailState] = await Promise.all([
          listAvailableGeminiModels(),
          getEmailState(),
        ])
        setModels(availableModels)
        if (availableModels.length && !availableModels.some(model => model.name.replace('models/', '') === getSelectedGeminiModel())) {
          const fallbackModel = availableModels[0].name.replace('models/', '')
          setSelectedGeminiModel(fallbackModel)
          setSelectedModelState(fallbackModel)
        }
        setEmailState(mailState)
      } catch (error) {
        setModelsError(error.message)
        setEmailError(error.message)
      } finally {
        setUsageStats(getGeminiUsageStats())
        setModelsLoading(false)
      }
    }

    load()

    const unsubscribe = subscribeToGeminiUsage((stats) => {
      setUsageStats(stats)
      setSelectedModelState(getSelectedGeminiModel())
    })

    const pollId = window.setInterval(() => {
      setUsageStats(getGeminiUsageStats())
      setSelectedModelState(getSelectedGeminiModel())
    }, 5000)

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        setUsageStats(getGeminiUsageStats())
        setSelectedModelState(getSelectedGeminiModel())
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      unsubscribe()
      window.clearInterval(pollId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  function saveModel(model) {
    setSelectedGeminiModel(model)
    setSelectedModelState(model)
  }

  function saveRepoUrl(value) {
    setRepoUrl(value)
    localStorage.setItem(REPO_URL_KEY, value)
  }

  function resetDashboardLayout() {
    localStorage.removeItem(HOME_LAYOUT_KEY)
    window.alert('Dashboard layout reset. Reload Home Base to use the default grid.')
  }

  function clearSheetCache() {
    localStorage.removeItem(SHEET_IDS_KEY)
    window.alert('Cached sheet ids cleared. The app will re-initialize sheets on the next sign-in or refresh.')
  }

  function saveNewsFeedPreferences() {
    const next = saveNewsPreferences({
      topics: parseFollowList(newsTopicsText),
      organizations: parseFollowList(newsOrganizationsText),
    })
    setNewsPreferences(next)
    setNewsTopicsText(formatFollowList(next.topics))
    setNewsOrganizationsText(formatFollowList(next.organizations))
    setNewsSavedNotice(`Saved ${next.topics.length} topics and ${next.organizations.length} organizations.`)
  }

  function restoreDefaultNewsFeedPreferences() {
    const next = resetNewsPreferences()
    setNewsPreferences(next)
    setNewsTopicsText(formatFollowList(next.topics))
    setNewsOrganizationsText(formatFollowList(next.organizations))
    setNewsSavedNotice('Restored the default Command Center follow list.')
  }

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />

      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/homebase')}>
          ← Back to Home Base
        </button>
        <div>
          <div className={styles.eyebrow}>Command Center Settings</div>
          <h1 className={styles.title}>System configuration and AI controls</h1>
        </div>
      </header>

      <main className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardTitle}>Repository Context</div>
          <div className={styles.rowLabel}>Repository URL</div>
          <input
            className={styles.input}
            value={repoUrl}
            onChange={e => saveRepoUrl(e.target.value)}
            placeholder="Paste the project repository URL here"
          />
          <p className={styles.helpText}>This is the project location Gemini should use for repository-aware context inside Command Center.</p>
          <div className={styles.usageLine}>Saved now: {repoUrl || 'No repository URL saved yet'}</div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>AI Model</div>
          <div className={styles.rowLabel}>Current model</div>
          <select className={styles.select} value={selectedModel} onChange={e => saveModel(e.target.value)}>
            {models.map(model => (
              <option key={model.name} value={model.name.replace('models/', '')}>
                {model.displayName}
              </option>
            ))}
            {!models.length && <option value={selectedModel}>{selectedModel}</option>}
          </select>
          <p className={styles.helpText}>Switches future chat requests to the selected Gemini model immediately. This page refreshes usage automatically while you keep it open.</p>
          <div className={styles.usageLine}>Selected now: {selectedModel}</div>
          {modelsLoading && <div className={styles.muted}>Loading available Gemini models...</div>}
          {modelsError && <div className={styles.error}>{modelsError}</div>}
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Gemini Usage</div>
          <p className={styles.helpText}>Open Google AI Studio to see your actual Gemini usage, quotas, API keys, and project limits directly from Google.</p>
          <a className={styles.usageLinkCard} href={GEMINI_USAGE_URL} target="_blank" rel="noreferrer">
            <span className={styles.usageLogo} aria-hidden="true">G</span>
            <span>
              <span className={styles.usageLinkTitle}>Open Google AI Studio</span>
              <span className={styles.usageLinkMeta}>View Gemini usage and limits</span>
            </span>
          </a>
        </section>

        <section className={`${styles.card} ${styles.cardWide}`}>
          <div className={styles.cardTitle}>Available Gemini Models</div>
          <div className={styles.modelList}>
            {models.map(model => (
              <div key={model.name} className={`${styles.modelRow} ${selectedModel === model.name.replace('models/', '') ? styles.modelRowActive : ''}`}>
                <div>
                  <div className={styles.modelName}>{model.displayName}</div>
                  <div className={styles.modelMeta}>{model.name.replace('models/', '')}</div>
                </div>
                <div className={styles.modelFacts}>
                  <span>{inferAvailability(usageStats[model.name.replace('models/', '')])}</span>
                  <span>{(model.supportedGenerationMethods || []).join(', ')}</span>
                  <button className={styles.modelSelectBtn} onClick={() => saveModel(model.name.replace('models/', ''))}>
                    {selectedModel === model.name.replace('models/', '') ? 'Selected' : 'Use model'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Email Accounts</div>
          {emailError && <div className={styles.error}>{emailError}</div>}
          {!emailError && emailState.accounts.length === 0 && <div className={styles.muted}>No email accounts are connected.</div>}
          {emailState.accounts.map(account => (
            <div key={account.id} className={styles.accountRow}>
              <div className={styles.accountName}>{account.label || account.id}</div>
              <div className={styles.accountMeta}>{account.address || 'No address'} • {account.provider} • {account.connected ? 'connected' : 'disconnected'}</div>
            </div>
          ))}
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>App Identity</div>
          <div className={styles.rowLabel}>Worlds</div>
          <div className={styles.tagWrap}>{manifest.worlds.map(item => <span key={item} className={styles.tag}>{item}</span>)}</div>
          <div className={styles.rowLabel}>Widgets</div>
          <div className={styles.tagWrap}>{manifest.widgets.map(item => <span key={item} className={styles.tag}>{item}</span>)}</div>
        </section>

        <section className={`${styles.card} ${styles.cardWide}`}>
          <div className={styles.cardTitle}>News Feed Following</div>
          <p className={styles.helpText}>Edit the topics and organizations that shape your Google News-based feed. Use one item per line or commas.</p>

          <div className={styles.rowLabel}>Topics</div>
          <textarea
            className={styles.textarea}
            value={newsTopicsText}
            onChange={e => {
              setNewsTopicsText(e.target.value)
              setNewsSavedNotice('')
            }}
            placeholder="AI&#10;U.S. Top Stories&#10;Atlanta Falcons"
            rows={10}
          />

          <div className={styles.rowLabel}>Organizations</div>
          <textarea
            className={styles.textarea}
            value={newsOrganizationsText}
            onChange={e => {
              setNewsOrganizationsText(e.target.value)
              setNewsSavedNotice('')
            }}
            placeholder="Reuters&#10;AP&#10;YouVersion Bible"
            rows={6}
          />

          <div className={styles.inlineActions}>
            <button className={styles.actionBtn} onClick={saveNewsFeedPreferences}>Save news feed</button>
            <button className={styles.secondaryBtn} onClick={restoreDefaultNewsFeedPreferences}>Restore defaults</button>
          </div>

          <div className={styles.helpText}>Active now: {newsPreferences.topics.length} topics, {newsPreferences.organizations.length} organizations.</div>
          {newsSavedNotice && <div className={styles.muted}>{newsSavedNotice}</div>}
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Sheets and Memory</div>
          <div className={styles.usageLine}>Sheets status: {sheetsReady ? 'online' : 'connecting'}</div>
          <div className={styles.usageLine}>Signed-in user: {user?.email || 'Not signed in'}</div>
          <div className={styles.usageLine}>Known sheet ids: {sheetIds ? Object.keys(sheetIds).length : 0}</div>
          <button className={styles.actionBtn} onClick={clearSheetCache}>Clear cached sheet ids</button>
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Layout and Local App State</div>
          <div className={styles.usageLine}>Weather city: {import.meta.env.VITE_WEATHER_CITY || 'Not set'}</div>
          <div className={styles.usageLine}>Dashboard layout key: {HOME_LAYOUT_KEY}</div>
          <button className={styles.actionBtn} onClick={resetDashboardLayout}>Reset Home Base layout</button>
        </section>
      </main>
    </div>
  )
}
