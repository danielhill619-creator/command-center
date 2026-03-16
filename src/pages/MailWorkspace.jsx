import { MailCenterProvider } from '../shared/hooks/useMailCenter'
import EmailCenter from '../widgets/email-center/EmailCenter'
import styles from './MailWorkspace.module.css'

export default function MailWorkspace() {
  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <main className={styles.workspaceShell}>
        <div className={styles.workspaceIntro}>
          <div className={styles.eyebrow}>Command Center Mail</div>
          <h1 className={styles.title}>Full Mail Workspace</h1>
        </div>
        <MailCenterProvider>
          <EmailCenter mode="workspace" />
        </MailCenterProvider>
      </main>
    </div>
  )
}
