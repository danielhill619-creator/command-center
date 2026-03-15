import { useNavigate } from 'react-router-dom'
import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import styles from './FunWorld.module.css'

export default function FunWorld() {
  const navigate = useNavigate()
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/homebase')}>
          ← HOME BASE
        </button>
        <span className={styles.worldName}>FUN</span>
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>Fun World</h1>
        <p className={styles.placeholder}>Phase 8 — Coming Soon</p>
      </main>
      <FloatingChat world="fun" />
    </div>
  )
}
