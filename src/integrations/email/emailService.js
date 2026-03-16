import { MOCK_FOLDERS } from './mockMailData'
import {
  clearStoredProviderAuth,
  connectGoogleMailAccount,
  connectMicrosoftMailAccount,
  ensureStoredProviderAuth,
  getProviderConfigStatus,
  getStoredProviderAuth,
  markStoredProviderAuthInvalid,
} from './emailAuth'

const PROVIDER_COLORS = { gmail: '#ea4335', microsoft: '#0078d4' }
import { gmailGetThread, gmailListMessages, gmailModifyMessage, gmailSendMessage, gmailTrashMessage } from './gmailProvider'
import { graphListMessages, graphMoveMessage, graphPatchMessage, graphSendMessage } from './microsoftProvider'
import {
  getOutlookBridgeUrl,
  outlookArchiveMessage,
  outlookBridgeHealth,
  outlookComposeMessage,
  outlookDeleteMessage,
  outlookForwardMessage,
  outlookGetThread,
  outlookListAccounts,
  outlookListMessages,
  outlookMarkRead,
  outlookMoveMessage,
  outlookReplyToMessage,
} from './outlookBridge'

const STORAGE_KEY = 'cc_email_state_v2'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function seedState() {
  return {
    accounts: [],
    folders: {},
    messages: [],
    drafts: [],
  }
}

function readState() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const state = seedState()
    writeState(state)
    return state
  }
  try {
    const parsed = sanitizeState(JSON.parse(raw))
    writeState(parsed)
    return parsed
  } catch {
    const state = seedState()
    writeState(state)
    return state
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function sanitizeState(state) {
  const accountIds = new Set((state.accounts || []).map(account => account.id))
  return {
    ...state,
    folders: Object.fromEntries(Object.entries(state.folders || {}).filter(([accountId]) => accountIds.has(accountId))),
    messages: (state.messages || []).filter(message => accountIds.has(message.accountId)),
  }
}

function sortByNewest(a, b) {
  return new Date(b.receivedAt) - new Date(a.receivedAt)
}

function providerStatus(provider) {
  const config = getProviderConfigStatus()
  if (provider === 'gmail') {
    return {
      live: config.gmail,
      reason: config.gmail ? 'Ready for Google OAuth login' : 'Needs Google OAuth client + Gmail scopes',
    }
  }
  return {
    live: config.microsoft,
    reason: config.microsoft ? 'Ready for Microsoft login' : 'Needs Microsoft Entra app + Graph Mail scopes',
  }
}

function hydrateAccount(a) {
  const stored = getStoredProviderAuth(a.id)
  return {
    ...a,
    ...(stored?.email ? { address: stored.email } : {}),
    ...(stored?.name ? { label: stored.name } : {}),
    connected: stored ? stored.connected !== false : !!a.connected,
    authError: stored?.lastError || '',
    providerStatus: providerStatus(a.provider),
  }
}

function isAuthError(error) {
  const message = `${error?.message || ''}`.toLowerCase()
  return message.includes('401') || message.includes('invalid authentication credentials') || message.includes('token')
}

function invalidateAccountAuth(accountId) {
  markStoredProviderAuthInvalid(accountId)
}

function getAccount(state, accountId) {
  const account = state.accounts.find(a => a.id === accountId)
  if (!account) throw new Error('MAIL_ACCOUNT_NOT_FOUND')
  return hydrateAccount(account)
}

async function getBridgeState() {
  const health = await outlookBridgeHealth()
  return health?.ok ? health : null
}

export async function getEmailState() {
  const state = readState()
  const bridge = await getBridgeState()
  if (bridge) {
    try {
      const accounts = await outlookListAccounts()
      return {
        bridge,
        bridgeUrl: getOutlookBridgeUrl(),
        accounts,
        folders: Object.fromEntries(accounts.map(a => [a.id, [...MOCK_FOLDERS]])),
      }
    } catch {
      // fall through
    }
  }

  await Promise.all(state.accounts.map(account => ensureStoredProviderAuth(account.id, account.provider).catch(() => null)))

  return {
    bridge,
    bridgeUrl: getOutlookBridgeUrl(),
    accounts: state.accounts.map(hydrateAccount),
    folders: state.folders,
  }
}

export async function listMessages({ accountId = 'all', folder = 'Inbox', query = '' } = {}) {
  const bridge = await getBridgeState()
  if (bridge) {
    try {
      return await outlookListMessages({ accountId, folder, query })
    } catch {
      // fall through
    }
  }

  const state = readState()

  // Single account — fetch live from provider
  if (accountId !== 'all') {
    const account = getAccount(state, accountId)
    if (account.connected) {
      try {
        const liveRows = account.provider === 'gmail'
          ? await gmailListMessages(account, { folder, query, maxResults: 18 })
          : await graphListMessages(account, { folder, query, top: 50 })
        return liveRows
          .sort(sortByNewest)
      } catch (e) {
        if (isAuthError(e)) invalidateAccountAuth(account.id)
        console.warn('[mail] live fetch failed for', accountId, e.message)
      }
    }
    // fall back to local state for this account
    const q = query.trim().toLowerCase()
    return state.messages
      .filter(m => m.accountId === accountId)
      .filter(m => folder === 'All Mail' || m.folder === folder)
      .filter(m => !q || `${m.subject} ${m.preview} ${m.from} ${m.body}`.toLowerCase().includes(q))
      .sort(sortByNewest)
  }

  // All accounts — aggregate live from every connected account
  const hydratedAccounts = state.accounts.map(hydrateAccount)
  const connected = hydratedAccounts.filter(a => a.connected)

  if (connected.length > 0) {
    const errors = []
    const results = await Promise.all(
      connected.map(account =>
        (account.provider === 'gmail'
          ? gmailListMessages(account, { folder, query, maxResults: 12 })
          : graphListMessages(account, { folder, query, top: 50 })
        )
        .then(rows => rows)
        .catch(e => {
          if (isAuthError(e)) invalidateAccountAuth(account.id)
          errors.push(`${account.label || account.id}: ${e.message}`)
          return []
        })
      )
    )
    const flat = results.flat().sort(sortByNewest)
    if (flat.length === 0 && errors.length > 0) {
      console.warn('[mail] all-accounts fetch issues:', errors.join(' | '))
      return []
    }
    return flat
  }

  // No connected accounts — return empty
  return []
}

export async function getThread(threadId, accountId) {
  const bridge = await getBridgeState()
  if (bridge) {
    try {
      return await outlookGetThread(threadId)
    } catch {
      // fall through
    }
  }

  // Try live Gmail thread fetch
  if (accountId) {
    const state = readState()
    const account = state.accounts.map(hydrateAccount).find(a => a.id === accountId)
    if (account?.connected && account.provider === 'gmail') {
      try {
        return await gmailGetThread(account, threadId)
      } catch (e) {
        if (isAuthError(e)) invalidateAccountAuth(account.id)
        console.warn('[mail] thread fetch failed', e.message)
      }
    }
  }

  const state = readState()
  return state.messages
    .filter(m => m.threadId === threadId)
    .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt))
}

export async function markRead(messageId, read = true, accountId = null) {
  const bridge = await getBridgeState()
  if (bridge) {
    try {
      await outlookMarkRead(messageId, read)
      return true
    } catch {
      // fall through
    }
  }

  const state = readState()
  const base = state.messages.find(m => m.id === messageId)
  const resolvedAccountId = base?.accountId || accountId
  if (resolvedAccountId) {
    const account = getAccount(state, resolvedAccountId)
    if (account.connected) {
      try {
        if (account.provider === 'gmail') {
          await gmailModifyMessage(account, messageId, read ? [] : ['UNREAD'], read ? ['UNREAD'] : [])
        } else {
          await graphPatchMessage(account, messageId, { isRead: read })
        }
      } catch (e) {
        if (isAuthError(e)) invalidateAccountAuth(account.id)
        // keep local fallback behavior
      }
    }
  }
  state.messages = state.messages.map(m => m.id === messageId ? { ...m, read } : m)
  writeState(state)
  return true
}

export async function moveMessage(messageId, folder, accountId = null) {
  const bridge = await getBridgeState()
  if (bridge) {
    try {
      await outlookMoveMessage(messageId, folder)
      return true
    } catch {
      // fall through
    }
  }

  const state = readState()
  const base = state.messages.find(m => m.id === messageId)
  const resolvedAccountId = base?.accountId || accountId
  if (resolvedAccountId) {
    const account = getAccount(state, resolvedAccountId)
    if (account.connected) {
      try {
        if (account.provider === 'gmail') {
          if (folder === 'Trash') {
            await gmailTrashMessage(account, messageId)
          } else {
            const add = folder === 'Sent' ? ['SENT'] : folder === 'Inbox' ? ['INBOX'] : []
            const remove = folder === 'Archive'
              ? ['INBOX']
              : folder === 'Inbox'
                ? ['TRASH']
                : []
            await gmailModifyMessage(account, messageId, add, remove)
          }
        } else {
          const folderMap = { Inbox: 'Inbox', Sent: 'SentItems', Drafts: 'Drafts', Archive: 'Archive', Trash: 'DeletedItems' }
          await graphMoveMessage(account, messageId, folderMap[folder] || 'Archive')
        }
      } catch (e) {
        if (isAuthError(e)) invalidateAccountAuth(account.id)
        // keep local fallback behavior
      }
    }
  }
  state.messages = state.messages.map(m => m.id === messageId ? { ...m, folder } : m)
  writeState(state)
  return true
}

export async function archiveMessage(messageId, accountId = null) {
  const bridge = await getBridgeState()
  if (bridge) {
    try {
      await outlookArchiveMessage(messageId)
      return true
    } catch {
      // fall through
    }
  }
  return moveMessage(messageId, 'Archive', accountId)
}

export async function deleteMessage(messageId, accountId = null) {
  const bridge = await getBridgeState()
  if (bridge) {
    try {
      await outlookDeleteMessage(messageId)
      return true
    } catch {
      // fall through
    }
  }
  return moveMessage(messageId, 'Trash', accountId)
}

export async function toggleStar(messageId, starred = true, accountId = null) {
  const state = readState()
  const base = state.messages.find(m => m.id === messageId)
  const resolvedAccountId = base?.accountId || accountId
  if (resolvedAccountId) {
    const account = getAccount(state, resolvedAccountId)
    if (account.connected && account.provider === 'gmail') {
      try {
        await gmailModifyMessage(account, messageId, starred ? ['STARRED'] : [], starred ? [] : ['STARRED'])
      } catch (e) {
        if (isAuthError(e)) invalidateAccountAuth(account.id)
        throw e
      }
    }
  }
  state.messages = state.messages.map(m => m.id === messageId ? { ...m, starred } : m)
  writeState(state)
  return true
}

export async function toggleImportant(messageId, important = true, accountId = null) {
  const state = readState()
  const base = state.messages.find(m => m.id === messageId)
  const resolvedAccountId = base?.accountId || accountId
  if (resolvedAccountId) {
    const account = getAccount(state, resolvedAccountId)
    if (account.connected && account.provider === 'gmail') {
      try {
        await gmailModifyMessage(account, messageId, important ? ['IMPORTANT'] : [], important ? [] : ['IMPORTANT'])
      } catch (e) {
        if (isAuthError(e)) invalidateAccountAuth(account.id)
        throw e
      }
    }
  }
  state.messages = state.messages.map(m => m.id === messageId ? { ...m, important } : m)
  writeState(state)
  return true
}

export async function composeMessage({ accountId, to, cc = [], subject, body }) {
  const bridge = await getBridgeState()
  if (bridge) {
    try {
      return await outlookComposeMessage({ accountId, to, cc, subject, body })
    } catch {
      // fall through
    }
  }

  const state = readState()
  const account = getAccount(state, accountId)

  if (account.connected) {
    try {
      if (account.provider === 'gmail') {
        await gmailSendMessage(account, { to, cc, subject, body })
      } else {
        await graphSendMessage(account, { to, cc, subject, body })
      }
      return { ok: true, live: true }
    } catch {
      // continue to local fallback save
    }
  }

  const msg = {
    id: `draft-${crypto.randomUUID()}`,
    accountId,
    folder: 'Sent',
    threadId: `thread-${crypto.randomUUID()}`,
    subject,
    preview: body.slice(0, 120),
    from: `${account.label} <${account.address}>`,
    to,
    cc,
    body,
    receivedAt: new Date().toISOString(),
    read: true,
    starred: false,
    hasAttachments: false,
    attachments: [],
  }

  state.messages.unshift(msg)
  writeState(state)
  return { ok: true, id: msg.id, live: false, note: 'Saved to local mock state. Live provider auth not connected yet.' }
}

export async function replyToMessage(messageId, { body, replyAll = false }) {
  const bridge = await getBridgeState()
  if (bridge) {
    try {
      return await outlookReplyToMessage(messageId, { body, replyAll })
    } catch {
      // fall through
    }
  }

  const state = readState()
  const base = state.messages.find(m => m.id === messageId)
  if (!base) throw new Error('MAIL_MESSAGE_NOT_FOUND')

  const account = getAccount(state, base.accountId)

  if (account.connected) {
    try {
      if (account.provider === 'gmail') {
        await gmailSendMessage(account, {
          to: [base.from],
          cc: replyAll ? base.cc : [],
          subject: base.subject.startsWith('Re:') ? base.subject : `Re: ${base.subject}`,
          body,
        })
      } else {
        await graphSendMessage(account, {
          to: [base.from],
          cc: replyAll ? base.cc : [],
          subject: base.subject.startsWith('Re:') ? base.subject : `Re: ${base.subject}`,
          body,
        })
      }
      return { ok: true, live: true }
    } catch {
      // local fallback below
    }
  }

  const msg = {
    id: `reply-${crypto.randomUUID()}`,
    accountId: base.accountId,
    folder: 'Sent',
    threadId: base.threadId,
    subject: base.subject.startsWith('Re:') ? base.subject : `Re: ${base.subject}`,
    preview: body.slice(0, 120),
    from: `${account.label} <${account.address}>`,
    to: [base.from],
    cc: replyAll ? base.cc : [],
    body,
    receivedAt: new Date().toISOString(),
    read: true,
    starred: false,
    hasAttachments: false,
    attachments: [],
  }

  state.messages.unshift(msg)
  writeState(state)
  return { ok: true, id: msg.id, live: false, note: 'Reply stored locally until provider auth is wired.' }
}

export async function forwardMessage(messageId, { to, body }) {
  const bridge = await getBridgeState()
  if (bridge) {
    try {
      return await outlookForwardMessage(messageId, { to, body })
    } catch {
      // fall through
    }
  }

  const state = readState()
  const base = state.messages.find(m => m.id === messageId)
  if (!base) throw new Error('MAIL_MESSAGE_NOT_FOUND')
  const account = getAccount(state, base.accountId)

  if (account.connected) {
    try {
      if (account.provider === 'gmail') {
        await gmailSendMessage(account, {
          to,
          cc: [],
          subject: base.subject.startsWith('Fwd:') ? base.subject : `Fwd: ${base.subject}`,
          body: `${body}\n\n--- Forwarded message ---\n${base.body}`,
        })
      } else {
        await graphSendMessage(account, {
          to,
          cc: [],
          subject: base.subject.startsWith('Fwd:') ? base.subject : `Fwd: ${base.subject}`,
          body: `${body}\n\n--- Forwarded message ---\n${base.body}`,
        })
      }
      return { ok: true, live: true }
    } catch {
      // local fallback below
    }
  }

  const msg = {
    id: `fwd-${crypto.randomUUID()}`,
    accountId: base.accountId,
    folder: 'Sent',
    threadId: `thread-${crypto.randomUUID()}`,
    subject: base.subject.startsWith('Fwd:') ? base.subject : `Fwd: ${base.subject}`,
    preview: body.slice(0, 120),
    from: `${account.label} <${account.address}>`,
    to,
    cc: [],
    body: `${body}\n\n--- Forwarded message ---\n${base.body}`,
    receivedAt: new Date().toISOString(),
    read: true,
    starred: false,
    hasAttachments: base.hasAttachments,
    attachments: base.attachments,
  }

  state.messages.unshift(msg)
  writeState(state)
  return { ok: true, id: msg.id, live: false, note: 'Forward stored locally until provider auth is wired.' }
}

export async function toggleAccountConnected(accountId, connected) {
  const bridge = await getBridgeState()
  if (bridge) {
    return true
  }

  const state = readState()
  const base = state.accounts.find(a => a.id === accountId)
  if (!base) throw new Error('MAIL_ACCOUNT_NOT_FOUND')

  if (!connected) {
    clearStoredProviderAuth(accountId)
    state.accounts = state.accounts.map(a => a.id === accountId ? { ...a, connected: false } : a)
    writeState(state)
    return true
  }

  const auth = base.provider === 'gmail'
    ? await connectGoogleMailAccount(accountId)
    : await connectMicrosoftMailAccount(accountId)

  state.accounts = state.accounts.map(a => a.id === accountId ? { ...a, connected: !!auth?.connected } : a)
  writeState(state)
  return true
}

export async function addAccount(provider) {
  const id = `${provider === 'gmail' ? 'gmail' : 'ms'}-${Date.now()}`

  const auth = provider === 'gmail'
    ? await connectGoogleMailAccount(id)
    : await connectMicrosoftMailAccount(id)

  const newAccount = {
    id,
    provider,
    label: auth?.name || (provider === 'gmail' ? 'Gmail Account' : 'Microsoft Account'),
    address: auth?.email || '',
    connected: !!auth?.connected,
    color: PROVIDER_COLORS[provider] ?? '#888',
  }

  const state = readState()
  state.accounts.push(newAccount)
  state.folders[id] = [...MOCK_FOLDERS]
  writeState(state)
  return newAccount
}

export async function removeAccount(accountId) {
  clearStoredProviderAuth(accountId)
  const state = readState()
  state.accounts = state.accounts.filter(a => a.id !== accountId)
  delete state.folders[accountId]
  state.messages = state.messages.filter(m => m.accountId !== accountId)
  writeState(state)
  return true
}

export function getProviderRequirements() {
  return {
    gmail: [
      'Google Cloud OAuth client ID',
      'Authorized origin for Firebase Hosting URL',
      'Gmail scopes: gmail.readonly, gmail.modify, gmail.send, gmail.compose',
    ],
    microsoft: [
      'Microsoft Entra app registration',
      'Redirect URI for Firebase Hosting URL',
      'Graph scopes: Mail.ReadWrite, Mail.Send, offline_access, User.Read',
    ],
  }
}
