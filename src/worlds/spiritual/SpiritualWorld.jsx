import { useNavigate } from 'react-router-dom'
import styles from './SpiritualWorld.module.css'

export default function SpiritualWorld() {
  const navigate = useNavigate()
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/homebase')}>
          ← HOME BASE
        </button>
        <span className={styles.worldName}>SPIRITUAL</span>
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>Spiritual World</h1>
        <p className={styles.placeholder}>Phase 9 — Coming Soon</p>
      </main>
    </div>
  )
}
