import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import styles from './SchoolWorld.module.css'

export default function SchoolWorld() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.heading}>School World</h1>
        <p className={styles.placeholder}>Phase 6 — Coming Soon</p>
      </main>
      <FloatingChat world="school" />
    </div>
  )
}
