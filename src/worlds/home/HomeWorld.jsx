import { useNavigate } from 'react-router-dom'
import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import styles from './HomeWorld.module.css'

export default function HomeWorld() {
  const navigate = useNavigate()
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/homebase')}>
          ← HOME BASE
        </button>
        <span className={styles.worldName}>HOME</span>
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>Home World</h1>
        <p className={styles.placeholder}>Phase 7 — Coming Soon</p>
      </main>
      <FloatingChat world="home" />
    </div>
  )
}
