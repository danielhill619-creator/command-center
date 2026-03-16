import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import styles from './SpiritualWorld.module.css'

export default function SpiritualWorld() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.heading}>Spiritual World</h1>
        <p className={styles.placeholder}>Phase 9 — Coming Soon</p>
      </main>
      <FloatingChat world="spiritual" />
    </div>
  )
}
