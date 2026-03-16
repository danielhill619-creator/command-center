import { useState, useEffect, createContext, useContext, useRef } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, reauthenticateWithPopup, signInWithPopup } from 'firebase/auth'
import { auth } from '../../firebase'
import { setAccessToken } from '../../integrations/google-sheets/sheetsService'
import { initializeSheets, getCachedSheetIds } from '../../integrations/google-sheets/sheetInitializer'

const AuthContext = createContext(null)

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
]

// In-memory cache so we don't re-read IDB on every call
let _cachedOAuthToken = null
let _cachedOAuthExpiry = 0

export async function getFreshGoogleOAuthToken(user) {
  // Return cached token if still fresh (> 5 minutes remaining)
  if (_cachedOAuthToken && _cachedOAuthExpiry > Date.now() + 5 * 60 * 1000) {
    return _cachedOAuthToken
  }

  const target = user || auth.currentUser
  if (!target) return null

  // Try silent re-auth with prompt:none — no visible popup if Google session is active
  try {
    const provider = new GoogleAuthProvider()
    GOOGLE_SCOPES.forEach(s => provider.addScope(s))
    provider.setCustomParameters({ prompt: 'none', access_type: 'offline' })
    let result
    try {
      result = await reauthenticateWithPopup(target, provider)
    } catch {
      result = await signInWithPopup(auth, provider)
    }
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (credential?.accessToken) {
      _cachedOAuthToken  = credential.accessToken
      _cachedOAuthExpiry = Date.now() + 55 * 60 * 1000 // treat as 55-min lifetime
      return _cachedOAuthToken
    }
  } catch {
    // Silent re-auth failed — fall through to IDB fallback
  }

  // IDB fallback: read the original credential stored at sign-in time
  // Only use the real oauthAccessToken, NOT the Firebase ID token
  try {
    const token = await readOAuthTokenFromIDB()
    if (token) {
      _cachedOAuthToken  = token
      _cachedOAuthExpiry = Date.now() + 50 * 60 * 1000
      return token
    }
  } catch {}

  return null
}

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [sheetIds, setSheetIds]       = useState(() => getCachedSheetIds())
  const [sheetsReady, setSheetsReady] = useState(false)
  const refreshTimerRef = useRef(null)

  async function initSheetsForUser(currentUser) {
    try {
      const oauthToken = await getFreshGoogleOAuthToken(currentUser)
      if (oauthToken) {
        setAccessToken(oauthToken)
        const ids = await initializeSheets()
        setSheetIds(ids)
        setSheetsReady(true)
        return true
      }
    } catch (err) {
      console.error('[CC] Sheet init error:', err)
    }
    setSheetsReady(false)
    return false
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        await initSheetsForUser(currentUser)
        // Proactively refresh the OAuth token every 50 minutes
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = setInterval(async () => {
          _cachedOAuthToken  = null
          _cachedOAuthExpiry = 0
          await initSheetsForUser(currentUser)
        }, 50 * 60 * 1000)
      } else {
        setSheetIds(null)
        setSheetsReady(false)
        _cachedOAuthToken  = null
        _cachedOAuthExpiry = 0
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      }
      setLoading(false)
    })

    return () => {
      unsubscribe()
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, sheetIds, sheetsReady }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

async function readOAuthTokenFromIDB() {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('firebaseLocalStorageDb')
    r.onsuccess = () => res(r.result)
    r.onerror   = () => rej(r.error)
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
    const token = record?.value?.credential?.oauthAccessToken ?? null
    if (token) return token
  }
  return null
}
