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
} from '../integrations/gemini-api/geminiService'
import styles from './Settings.module.css'

const HOME_LAYOUT_KEY = 'cc_home_dashboard_layout_v1'
const SHEET_IDS_KEY = 'cc_sheet_ids'
const REPO_URL_KEY = 'cc_repo_url_v1'

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

function getUsageShare(modelName, usageStats) {
  const modelKey = modelName.replace('models/', '')
  const total = Object.values(usageStats).reduce((sum, stats) => sum + Number(stats.requests || 0), 0)
  const current = Number(usageStats[modelKey]?.requests || 0)
  if (!total) return '0%'
  return `${Math.round((current / total) * 100)}%`
}

function inferAvailability(stats) {
  const error = `${stats?.lastError || ''}`.toLowerCase()
  if (error.includes('quota') || error.includes('429')) return 'Exhausted'
  if (stats?.requests > 0) return 'Available'
  return 'Unknown'
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, sheetsReady, sheetIds } = useAuth()
  const [repoUrl, setRepoUrl] = useState(() => localStorage.getItem(REPO_URL_KEY) || '')
  const [selectedModel, setSelectedModelState] = useState(() => getSelectedGeminiModel())
  const [models, setModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState('')
  const [usageStats, setUsageStats] = useState(() => getGeminiUsageStats())
  const [emailState, setEmailState] = useState({ accounts: [], folders: {} })
  const [emailError, setEmailError] = useState('')

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
          <p className={styles.helpText}>Switches future chat requests to the selected Gemini model immediately.</p>
          {modelsLoading && <div className={styles.muted}>Loading available Gemini models...</div>}
          {modelsError && <div className={styles.error}>{modelsError}</div>}
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Usage Snapshot</div>
          <p className={styles.helpText}>Google is not giving this frontend a trustworthy per-model remaining-quota API, so this panel shows live availability state instead of fake percentage math.</p>
          <div className={styles.usageGrid}>
            {Object.entries(usageStats).length === 0 && <div className={styles.muted}>No Gemini usage has been recorded in this browser yet.</div>}
            {Object.entries(usageStats).map(([model, stats]) => (
              <div key={model} className={styles.usageCard}>
                <div className={styles.usageModel}>{model}</div>
                <div className={styles.usageLine}>Availability: {inferAvailability(stats)}</div>
                <div className={styles.usageLine}>State: {stats.lastError ? 'Blocked or degraded' : stats.requests > 0 ? 'Active' : 'Not sampled yet'}</div>
                <div className={styles.usageLine}>Requests seen here: {formatNumber(stats.requests)}</div>
                <div className={styles.usageLine}>Last used: {stats.lastUsedAt || 'Never'}</div>
                {stats.lastError && <div className={styles.error}>Last error: {stats.lastError}</div>}
              </div>
            ))}
          </div>
        </section>

        <section className={`${styles.card} ${styles.cardWide}`}>
          <div className={styles.cardTitle}>Available Gemini Models</div>
          <div className={styles.modelList}>
            {models.map(model => (
              <div key={model.name} className={styles.modelRow}>
                <div>
                  <div className={styles.modelName}>{model.displayName}</div>
                  <div className={styles.modelMeta}>{model.name.replace('models/', '')}</div>
                </div>
                <div className={styles.modelFacts}>
                  <span>{getUsageShare(model.name, usageStats)} of local usage</span>
                  <span>{(model.supportedGenerationMethods || []).join(', ')}</span>
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
          <div className={styles.rowLabel}>Repository URL</div>
          <input
            className={styles.input}
            value={repoUrl}
            onChange={e => saveRepoUrl(e.target.value)}
            placeholder="Paste the project repository URL here"
          />
          <p className={styles.helpText}>Stored locally for now so Gemini can reference where this app lives once we surface it in prompts and tools.</p>
          <div className={styles.rowLabel}>Worlds</div>
          <div className={styles.tagWrap}>{manifest.worlds.map(item => <span key={item} className={styles.tag}>{item}</span>)}</div>
          <div className={styles.rowLabel}>Widgets</div>
          <div className={styles.tagWrap}>{manifest.widgets.map(item => <span key={item} className={styles.tag}>{item}</span>)}</div>
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
