import { PublicClientApplication } from '@azure/msal-browser'
import { getAuth, GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup } from 'firebase/auth'

const STORAGE_KEY = 'cc_email_provider_auth_v1'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
]

const MS_GRAPH_SCOPES = ['User.Read', 'Mail.ReadWrite', 'Mail.Send', 'offline_access']

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeStore(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function upsertAccount(accountId, payload) {
  const state = readStore()
  state[accountId] = {
    ...(state[accountId] || {}),
    ...payload,
  }
  writeStore(state)
  return state[accountId]
}

export function getStoredProviderAuth(accountId) {
  const state = readStore()
  return state[accountId] || null
}

export function clearStoredProviderAuth(accountId) {
  const state = readStore()
  delete state[accountId]
  writeStore(state)
}

export function markStoredProviderAuthInvalid(accountId) {
  const state = readStore()
  if (!state[accountId]) return null
  state[accountId] = {
    ...state[accountId],
    accessToken: null,
    expiresAt: 0,
    connected: false,
    lastError: 'Authentication expired. Reconnect this account.',
  }
  writeStore(state)
  return state[accountId]
}

// ── Google OAuth via Firebase reauth (no separate client ID needed) ──────────

export async function connectGoogleMailAccount(accountId) {
  const auth = getAuth()
  const user = auth.currentUser
  if (!user) throw new Error('NOT_SIGNED_IN')

  const provider = new GoogleAuthProvider()
  GMAIL_SCOPES.forEach(s => provider.addScope(s))
  // prompt: 'select_account' lets the user pick which Google account to connect
  provider.setCustomParameters({ prompt: 'select_account consent', access_type: 'offline' })

  let result
  try {
    // Try reauth first (works when current user is a Google user)
    result = await reauthenticateWithPopup(user, provider)
  } catch {
    // Fallback: full sign-in popup (handles edge cases like email/password users)
    result = await signInWithPopup(auth, provider)
  }

  const credential = GoogleAuthProvider.credentialFromResult(result)
  if (!credential?.accessToken) throw new Error('GOOGLE_TOKEN_FAILED')

  const record = upsertAccount(accountId, {
    provider: 'gmail',
    accessToken: credential.accessToken,
    expiresAt: Date.now() + 3600 * 1000,
    email: result.user.email,
    name: result.user.displayName,
    connected: true,
  })

  return record
}

// ── Microsoft Graph / Exchange Online ───────────────────────────────────────

let _msal = null

function getMsal() {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID
  const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'
  if (!clientId) throw new Error('MICROSOFT_CLIENT_ID_MISSING')
  if (_msal) return _msal

  _msal = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false,
    },
  })
  return _msal
}

export async function connectMicrosoftMailAccount(accountId) {
  const msal = getMsal()
  await msal.initialize()
  const login = await msal.loginPopup({ scopes: MS_GRAPH_SCOPES, prompt: 'select_account' })
  msal.setActiveAccount(login.account)
  const token = await msal.acquireTokenSilent({ account: login.account, scopes: MS_GRAPH_SCOPES })

  const record = upsertAccount(accountId, {
    provider: 'microsoft',
    accessToken: token.accessToken,
    expiresAt: token.expiresOn?.getTime() ?? (Date.now() + 3600 * 1000),
    email: login.account.username,
    name: login.account.name,
    homeAccountId: login.account.homeAccountId,
    connected: true,
  })

  return record
}

export async function refreshMicrosoftMailToken(accountId) {
  const stored = getStoredProviderAuth(accountId)
  if (!stored?.homeAccountId) throw new Error('MICROSOFT_ACCOUNT_NOT_CONNECTED')
  const msal = getMsal()
  await msal.initialize()
  const account = msal.getAllAccounts().find(a => a.homeAccountId === stored.homeAccountId)
  if (!account) throw new Error('MICROSOFT_ACCOUNT_SESSION_MISSING')
  const token = await msal.acquireTokenSilent({ account, scopes: MS_GRAPH_SCOPES })
  return upsertAccount(accountId, {
    accessToken: token.accessToken,
    expiresAt: token.expiresOn?.getTime() ?? (Date.now() + 3600 * 1000),
    connected: true,
  })
}

export async function getLiveAccessToken(account) {
  const stored = getStoredProviderAuth(account.id)

  // Token still fresh
  if (stored?.accessToken && stored.expiresAt && stored.expiresAt > Date.now() + 30_000) {
    return stored.accessToken
  }

  if (account.provider === 'microsoft') {
    const refreshed = await refreshMicrosoftMailToken(account.id)
    return refreshed.accessToken
  }

  // Gmail — try to pull a fresh token from Firebase's IndexedDB session
  if (account.provider === 'gmail') {
    const fresh = await getFirebaseGoogleToken()
    if (fresh) {
      upsertAccount(account.id, {
        accessToken: fresh,
        expiresAt: Date.now() + 3600 * 1000,
      })
      return fresh
    }
  }

  return null
}

async function getFirebaseGoogleToken() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('firebaseLocalStorageDb')
      r.onsuccess = () => res(r.result)
      r.onerror  = () => rej(r.error)
    })
    const tx    = db.transaction('firebaseLocalStorage', 'readonly')
    const store = tx.objectStore('firebaseLocalStorage')
    const keys  = await new Promise((res, rej) => {
      const r = store.getAllKeys()
      r.onsuccess = () => res(r.result)
      r.onerror   = () => rej(r.error)
    })
    for (const key of keys) {
      const record = await new Promise((res, rej) => {
        const r = store.get(key)
        r.onsuccess = () => res(r.result)
        r.onerror   = () => rej(r.error)
      })
      const token =
        record?.value?.credential?.oauthAccessToken ?? null
      if (token) return token
    }
    return null
  } catch {
    return null
  }
}

export function getProviderConfigStatus() {
  return {
    gmail: true, // uses Firebase Google auth — no separate client ID needed
    microsoft: !!import.meta.env.VITE_MICROSOFT_CLIENT_ID,
  }
}
