import { useState, useEffect, createContext, useContext, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../firebase'
import { setAccessToken } from '../../integrations/google-sheets/sheetsService'
import { initializeSheets, getCachedSheetIds } from '../../integrations/google-sheets/sheetInitializer'
import { getGoogleToken, storeGoogleToken, clearGoogleToken } from '../../integrations/gis-auth'

const AuthContext = createContext(null)

export { getGoogleToken, storeGoogleToken }

async function initInBackground(currentUser, setSheetIds, setSheetsReady) {
  try {
    const seeded = await seedTokenFromIDB()
    const token  = seeded || await getGoogleToken({ interactive: false })
    if (token) {
      setAccessToken(token)
      const ids = await initializeSheets()
      setSheetIds(ids)
      setSheetsReady(true)
    }
  } catch {
    setSheetsReady(false)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(auth.currentUser)
  const [loading, setLoading]         = useState(!auth.currentUser)
  const [sheetIds, setSheetIds]       = useState(() => getCachedSheetIds())
  const [sheetsReady, setSheetsReady] = useState(false)
  const readyRef = useRef(false)

  useEffect(() => {
    let active = true

    auth.authStateReady()
      .then(() => {
        if (!active) return
        readyRef.current = true
        const currentUser = auth.currentUser
        setUser(currentUser)
        setLoading(false)

        if (currentUser) {
          initInBackground(currentUser, setSheetIds, setSheetsReady)
        } else {
          setSheetIds(null)
          setSheetsReady(false)
          clearGoogleToken()
        }
      })
      .catch(() => {
        if (!active) return
        readyRef.current = true
        setLoading(false)
      })

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!active || !readyRef.current) return
      setUser(currentUser)

      if (currentUser) {
        initInBackground(currentUser, setSheetIds, setSheetsReady)
      } else {
        setSheetIds(null)
        setSheetsReady(false)
        clearGoogleToken()
      }
    })

    return () => {
      active = false
      unsubscribe()
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

/**
 * On first load, seed GIS with the OAuth credential stored by Firebase.
 * This avoids needing a GIS popup on the very first session after sign-in.
 * Only reads credential.oauthAccessToken — NOT the Firebase ID token.
 */
async function seedTokenFromIDB() {
  try {
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
      if (token) {
        storeGoogleToken(token)
        return token
      }
    }
  } catch {}
  return null
}
