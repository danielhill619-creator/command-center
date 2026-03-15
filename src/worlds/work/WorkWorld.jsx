import { useNavigate } from 'react-router-dom'
import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import styles from './WorkWorld.module.css'

export default function WorkWorld() {
  const navigate = useNavigate()
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/homebase')}>
          ← HOME BASE
        </button>
        <span className={styles.worldName}>WORK</span>
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>Work World</h1>
        <p className={styles.placeholder}>Phase 5 — Coming Soon</p>
      </main>
      <FloatingChat world="work" />
    </div>
  )
}
