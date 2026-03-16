import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import styles from './FunWorld.module.css'

export default function FunWorld() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.heading}>Fun World</h1>
        <p className={styles.placeholder}>Phase 8 — Coming Soon</p>
      </main>
      <FloatingChat world="fun" />
    </div>
  )
}
