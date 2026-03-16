import { useState, useEffect, createContext, useContext } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../firebase'
import { setAccessToken } from '../../integrations/google-sheets/sheetsService'
import { initializeSheets, getCachedSheetIds } from '../../integrations/google-sheets/sheetInitializer'
import { getGoogleToken, storeGoogleToken, clearGoogleToken } from '../../integrations/gis-auth'

const AuthContext = createContext(null)

export { getGoogleToken, storeGoogleToken }

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
          // Seed GIS with the Firebase-stored OAuth credential so it's immediately
          // available this session without needing a GIS popup on first load
          const seeded = await seedTokenFromIDB()

          // Then get a GIS token (silent — no popup if consent was previously granted)
          const token = seeded || await getGoogleToken({ interactive: false })

          if (token) {
            setAccessToken(token)
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
        clearGoogleToken()
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
