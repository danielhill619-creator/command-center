import { useNavigate } from 'react-router-dom'
import { MailCenterProvider } from '../shared/hooks/useMailCenter'
import EmailCenter from '../widgets/email-center/EmailCenter'
import styles from './MailWorkspace.module.css'

export default function MailWorkspace() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Command Center Mail</div>
          <h1 className={styles.title}>Full Mail Workspace</h1>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.headerBtn} onClick={() => navigate('/homebase')}>Home Base</button>
          <button className={styles.headerBtn} onClick={() => navigate('/settings')}>Settings</button>
        </div>
      </header>

      <main className={styles.workspaceShell}>
        <MailCenterProvider>
          <EmailCenter mode="workspace" />
        </MailCenterProvider>
      </main>
    </div>
  )
}
