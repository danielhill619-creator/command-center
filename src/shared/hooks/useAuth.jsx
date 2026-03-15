import { useState, useEffect, createContext, useContext } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../firebase'
import { setAccessToken } from '../../integrations/google-sheets/sheetsService'
import { initializeSheets, getCachedSheetIds } from '../../integrations/google-sheets/sheetInitializer'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [sheetIds, setSheetIds]       = useState(() => getCachedSheetIds())
  const [sheetsReady, setSheetsReady] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        try {
          const oauthToken = await getGoogleOAuthToken(currentUser)
          if (oauthToken) {
            setAccessToken(oauthToken)
            const ids = await initializeSheets()
            setSheetIds(ids)
            setSheetsReady(true)
          }
        } catch (err) {
          console.error('[CC] Sheet init error:', err)
          setSheetsReady(false)
        }
      } else {
        setSheetIds(null)
        setSheetsReady(false)
      }

      setLoading(false)
    })

    return () => unsubscribe()
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

/**
 * Retrieve the Google OAuth access token from Firebase's IndexedDB store.
 * Firebase persists the credential (including oauthAccessToken) in IDB
 * after a successful signInWithPopup.
 */
async function getGoogleOAuthToken(user) {
  try {
    const db = await openIDB('firebaseLocalStorageDb')
    const tx = db.transaction('firebaseLocalStorage', 'readonly')
    const store = tx.objectStore('firebaseLocalStorage')
    const keys = await idbGetAllKeys(store)

    for (const key of keys) {
      const record = await idbGet(store, key)
      // Try multiple known locations in the Firebase IDB record structure
      const token =
        record?.value?.credential?.oauthAccessToken ??
        record?.value?.stsTokenManager?.accessToken ??
        null
      if (token) return token
    }
    return null
  } catch (err) {
    console.warn('[CC] Could not read OAuth token from IDB:', err)
    return null
  }
}

function openIDB(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name)
    req.onsuccess = () => resolve(req.result)
    req.onerror  = () => reject(req.error)
  })
}

function idbGetAllKeys(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAllKeys()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function idbGet(store, key) {
  return new Promise((resolve, reject) => {
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}
