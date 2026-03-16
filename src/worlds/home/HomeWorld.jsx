import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import styles from './HomeWorld.module.css'

export default function HomeWorld() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.heading}>Home World</h1>
        <p className={styles.placeholder}>Phase 7 — Coming Soon</p>
      </main>
      <FloatingChat world="home" />
    </div>
  )
}
