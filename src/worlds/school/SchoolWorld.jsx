import { useNavigate } from 'react-router-dom'
import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import styles from './SchoolWorld.module.css'

export default function SchoolWorld() {
  const navigate = useNavigate()
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/homebase')}>
          ← HOME BASE
        </button>
        <span className={styles.worldName}>SCHOOL</span>
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>School World</h1>
        <p className={styles.placeholder}>Phase 6 — Coming Soon</p>
      </main>
      <FloatingChat world="school" />
    </div>
  )
}
