import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  addAccount,
  archiveMessage,
  composeMessage,
  deleteMessage,
  forwardMessage,
  getEmailState,
  getProviderRequirements,
  getThread,
  listMessages,
  markRead,
  moveMessage,
  removeAccount,
  replyToMessage,
  toggleAccountConnected,
} from '../../integrations/email/emailService'

const MailCenterContext = createContext(null)

function useMailCenterState() {
  const [accounts, setAccounts]         = useState([])
  const [folders, setFolders]           = useState({})
  const [bridge, setBridge]             = useState(null)
  const [bridgeUrl, setBridgeUrl]       = useState('')
  const [messages, setMessages]         = useState([])
  const [selectedId, setSelectedId]     = useState(null)
  const [selectedThread, setSelectedThread] = useState([])
  const [accountId, setAccountId]       = useState('all')
  const [folder, setFolder]             = useState('Inbox')
  const [query, setQuery]               = useState('')
  const [loading, setLoading]           = useState(true)
  const [busy, setBusy]                 = useState(false)
  const [fetchError, setFetchError]     = useState('')
  const [actionError, setActionError]   = useState('')
  const cache  = useRef(new Map())
  const threadCache = useRef(new Map())
  const refreshSeqRef = useRef(0)
  // keep latest selectedId accessible inside refresh without it being a dep
  const selectedIdRef = useRef(selectedId)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  const getCacheKey = useCallback((nextAccountId = accountId, nextFolder = folder, nextQuery = query) => `${nextAccountId}:${nextFolder}:${nextQuery}`, [accountId, folder, query])

  // ── Refresh list (does NOT depend on selectedId) ──────────────────────────
  const refresh = useCallback(async () => {
    const refreshSeq = ++refreshSeqRef.current
    const cacheKey = getCacheKey(accountId, folder, query)
    const cached = cache.current.get(cacheKey)
    if (cached) setMessages(cached)
    setLoading(!cached)
    setFetchError('')
    try {
      const [state, rows] = await Promise.all([
        getEmailState(),
        listMessages({ accountId, folder, query }),
      ])
      if (refreshSeq !== refreshSeqRef.current) return
      cache.current.set(cacheKey, rows)
      setBridge(state.bridge || null)
      setBridgeUrl(state.bridgeUrl || '')
      setAccounts(state.accounts)
      setFolders(state.folders)
      setMessages(rows)
      if (selectedIdRef.current && !rows.some(message => message.id === selectedIdRef.current)) {
        setSelectedId(rows[0]?.id ?? null)
        setSelectedThread(rows[0] ? [rows[0]] : [])
      }
    } catch (e) {
      if (refreshSeq !== refreshSeqRef.current) return
      setFetchError(e.message)
    } finally {
      if (refreshSeq === refreshSeqRef.current) setLoading(false)
    }
  }, [accountId, folder, getCacheKey, query])  // ← NO selectedId here

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    setSelectedId(null)
    setSelectedThread([])
  }, [accountId, folder, query])

  // ── Select a message (optimistic, no full refresh) ────────────────────────
  async function selectMessage(message) {
    setSelectedId(message.id)
    const cachedThread = threadCache.current.get(`${message.accountId}:${message.threadId}`)
    setSelectedThread(cachedThread || [message])

    // Optimistically mark read in UI immediately
    if (!message.read) {
      setMessages(prev => prev.map(m =>
        m.id === message.id ? { ...m, read: true } : m
      ))
      cache.current.delete(getCacheKey())
      // Fire-and-forget to the API
      markRead(message.id, true, message.accountId).catch(() => {})
    }

    // Fetch thread in background
    try {
      const thread = await getThread(message.threadId, message.accountId)
      threadCache.current.set(`${message.accountId}:${message.threadId}`, thread)
      setSelectedThread(thread)
    } catch {
      setSelectedThread([message]) // fallback: show just the clicked message
    }
  }

  useEffect(() => {
    const connectedAccounts = accounts.filter(account => account.connected)
    connectedAccounts.forEach(account => {
      const inboxKey = getCacheKey(account.id, 'Inbox', '')
      if (!cache.current.has(inboxKey)) {
        listMessages({ accountId: account.id, folder: 'Inbox', query: '' })
          .then(rows => {
            cache.current.set(inboxKey, rows)
          })
          .catch(() => {})
      }
    })
  }, [accounts, getCacheKey])

  function removeMessageLocally(id) {
    setMessages(prev => {
      const index = prev.findIndex(message => message.id === id)
      const next = prev.filter(message => message.id !== id)
      if (selectedIdRef.current === id) {
        const replacement = next[index] || next[index - 1] || null
        setSelectedId(replacement?.id ?? null)
        setSelectedThread(replacement ? [replacement] : [])
      }
      return next
    })
  }

  function updateMessageLocally(id, updater) {
    setMessages(prev => prev.map(message => message.id === id ? updater(message) : message))
    setSelectedThread(prev => prev.map(message => message.id === id ? updater(message) : message))
  }

  function removeMessagesLocally(ids) {
    const idSet = new Set(ids)
    setMessages(prev => {
      const next = prev.filter(message => !idSet.has(message.id))
      if (selectedIdRef.current && idSet.has(selectedIdRef.current)) {
        setSelectedId(next[0]?.id ?? null)
        setSelectedThread(next[0] ? [next[0]] : [])
      }
      return next
    })
  }

  function updateMessagesLocally(ids, updater) {
    const idSet = new Set(ids)
    setMessages(prev => prev.map(message => idSet.has(message.id) ? updater(message) : message))
    setSelectedThread(prev => prev.map(message => idSet.has(message.id) ? updater(message) : message))
  }

  async function perform(action, optimistic) {
    setBusy(true)
    setActionError('')
    cache.current.delete(getCacheKey())
    if (optimistic) optimistic()
    try {
      await action()
      refresh().catch(() => {})
    } catch (error) {
      setActionError(error.message || 'Mail action failed')
      throw error
    } finally {
      setBusy(false)
    }
  }

  const selectedMessage = useMemo(
    () => messages.find(m => m.id === selectedId) ?? null,
    [messages, selectedId]
  )

  return {
    fetchError,
    accounts,
    folders,
    bridge,
    bridgeUrl,
    messages,
    selectedId,
    selectedMessage,
    selectedThread,
    accountId,
    setAccountId,
    folder,
    setFolder,
    query,
    setQuery,
    loading,
    busy,
    actionError,
    refresh,
    selectMessage,
    markRead:              (id, read, accountId) => perform(
      () => markRead(id, read, accountId),
      () => updateMessageLocally(id, message => ({ ...message, read }))
    ),
    moveMessage:           (id, f, accountId) => perform(
      () => moveMessage(id, f, accountId),
      () => removeMessageLocally(id)
    ),
    archiveMessage:        (id, accountId) => perform(
      () => archiveMessage(id, accountId),
      () => removeMessageLocally(id)
    ),
    deleteMessage:         (id, accountId) => perform(
      () => deleteMessage(id, accountId),
      () => removeMessageLocally(id)
    ),
    bulkMarkRead:          entries => perform(
      () => Promise.all(entries.map(entry => markRead(entry.id, entry.read, entry.accountId))),
      () => updateMessagesLocally(entries.map(entry => entry.id), message => {
        const match = entries.find(entry => entry.id === message.id)
        return match ? { ...message, read: match.read } : message
      })
    ),
    bulkArchive:           entries => perform(
      () => Promise.all(entries.map(entry => archiveMessage(entry.id, entry.accountId))),
      () => removeMessagesLocally(entries.map(entry => entry.id))
    ),
    bulkDelete:            entries => perform(
      () => Promise.all(entries.map(entry => deleteMessage(entry.id, entry.accountId))),
      () => removeMessagesLocally(entries.map(entry => entry.id))
    ),
    composeMessage:        payload       => perform(() => composeMessage(payload)),
    replyToMessage:        (id, payload) => perform(() => replyToMessage(id, payload)),
    forwardMessage:        (id, payload) => perform(() => forwardMessage(id, payload)),
    toggleAccountConnected:(id, conn)    => perform(() => toggleAccountConnected(id, conn)),
    addAccount:            provider      => perform(() => addAccount(provider)),
    removeAccount:         id            => perform(() => removeAccount(id)),
    providerRequirements:  getProviderRequirements(),
  }
}

export function MailCenterProvider({ children }) {
  const value = useMailCenterState()
  return createElement(MailCenterContext.Provider, { value }, children)
}

export function useOptionalMailCenter() {
  return useContext(MailCenterContext)
}

export default function useMailCenter() {
  return useOptionalMailCenter() || useMailCenterState()
}
