/**
 * gis-auth.js
 *
 * Google Identity Services token client.
 * Replaces the broken IndexedDB approach with proper silent token refresh.
 *
 * First consent: one popup, user grants scopes.
 * Every subsequent refresh: completely silent, no popup, no re-login.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
].join(' ')

let _client     = null
let _token      = null
let _expiry     = 0
let _refreshing = null  // deduplicate concurrent refresh calls

// ── Wait for GIS script to load ───────────────────────────────────────────────

function waitForGIS(timeoutMs = 10_000) {
  if (window.google?.accounts?.oauth2) return Promise.resolve(true)
  return new Promise(resolve => {
    const deadline = Date.now() + timeoutMs
    const id = setInterval(() => {
      if (window.google?.accounts?.oauth2) { clearInterval(id); resolve(true)  }
      if (Date.now() > deadline)           { clearInterval(id); resolve(false) }
    }, 100)
  })
}

// ── Token client singleton ────────────────────────────────────────────────────

async function getClient() {
  if (_client) return _client
  const ok = await waitForGIS()
  if (!ok || !window.google?.accounts?.oauth2) return null
  _client = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope:     SCOPES,
    callback:  () => {},      // overridden per-request below
    error_callback: () => {},
  })
  return _client
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get a valid Google OAuth access token.
 *
 * @param {object} options
 * @param {boolean} options.interactive
 *   false (default) — silent; fails silently if consent is needed
 *   true            — shows consent popup if required (call from a user gesture)
 */
export async function getGoogleToken({ interactive = false } = {}) {
  // Return in-memory cached token when still fresh (> 2 min remaining)
  if (_token && _expiry > Date.now() + 2 * 60_000) return _token

  // Deduplicate: if a refresh is already in-flight, wait for it
  if (_refreshing) return _refreshing

  _refreshing = _requestToken(interactive).finally(() => { _refreshing = null })
  return _refreshing
}

async function _requestToken(interactive) {
  const client = await getClient()
  if (!client) return null

  return new Promise(resolve => {
    client.callback = (response) => {
      if (response.error) {
        // 'interaction_required' in silent mode is not an error — user just needs to reconnect
        resolve(null)
        return
      }
      _token  = response.access_token
      _expiry = Date.now() + ((response.expires_in ?? 3600) * 1000)
      resolve(_token)
    }

    client.requestAccessToken({
      prompt: interactive ? 'consent' : '',
      // hint: provide the user's email to skip account picker on reconnect
    })
  })
}

/**
 * Manually store a token (e.g. obtained from Firebase signInWithPopup credential).
 * Lets the app stay connected immediately after sign-in without waiting for GIS.
 */
export function storeGoogleToken(token, expiresInSeconds = 3550) {
  _token  = token
  _expiry = Date.now() + expiresInSeconds * 1000
}

/** Clear the in-memory token (e.g. on sign-out). */
export function clearGoogleToken() {
  _token  = null
  _expiry = 0
}
