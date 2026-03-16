const APP_MANIFEST = {
  appName: 'Command Center',
  worlds: ['homebase', 'work', 'school', 'home', 'fun', 'spiritual'],
  widgets: [
    'email-center',
    'floating-chat',
    'weather',
    'sysmonitor',
    'newsreel',
    'gemini-panel',
  ],
  routes: ['/homebase', '/work', '/school', '/home', '/fun', '/spiritual', '/login'],
  architecture: [
    'src/worlds/homebase for the dashboard shell and widget grid',
    'src/worlds/work for the work-world sections and data views',
    'src/widgets/email-center for mailbox UI',
    'src/widgets/floating-chat for the global Gemini assistant',
    'src/shared/hooks/useGemini.jsx for assistant behavior',
    'src/shared/hooks/useMailCenter.js for live mailbox state',
    'src/integrations/gemini-api for Gemini transport and tools',
    'src/integrations/ai-memory for Google Sheets memory',
  ],
  emailCapabilities: [
    'list connected accounts',
    'list messages for the current folder',
    'read the selected thread',
    'mark messages read or unread',
    'archive and delete messages',
    'compose new mail',
    'reply to the selected or specified message',
  ],
}

const REPO_URL_KEY = 'cc_repo_url_v1'

function summarizeAccounts(accounts = []) {
  if (!accounts.length) return 'No email accounts are currently connected.'

  return accounts.map(account => {
    const status = account.connected ? 'connected' : 'disconnected'
    const address = account.address || 'unknown address'
    const authNote = account.authError ? `; auth issue: ${account.authError}` : ''
    return `- ${account.label || account.id} (${address}) via ${account.provider} is ${status}${authNote}`
  }).join('\n')
}

function summarizeMessages(messages = [], limit = 8) {
  if (!messages.length) return 'No messages are loaded in the current mailbox view.'

  return messages.slice(0, limit).map(message => {
    const unread = message.read ? 'read' : 'unread'
    const from = message.from || 'unknown sender'
    const subject = message.subject || '(no subject)'
    return `- [${message.id}] ${subject} from ${from} in ${message.folder} (${unread})`
  }).join('\n')
}

export function buildRuntimeAppContext({
  world = 'homebase',
  route = '',
  email = null,
} = {}) {
  const parts = [
    '=== COMMAND CENTER APP ===',
    `App: ${APP_MANIFEST.appName}`,
    `Current world: ${world}`,
    `Current route: ${route || window.location.pathname || '/'}`,
    `Known worlds: ${APP_MANIFEST.worlds.join(', ')}`,
    `Known routes: ${APP_MANIFEST.routes.join(', ')}`,
    `Known widgets: ${APP_MANIFEST.widgets.join(', ')}`,
    `Architecture map: ${APP_MANIFEST.architecture.join(' | ')}`,
  ]

  const repoUrl = localStorage.getItem(REPO_URL_KEY) || ''
  if (repoUrl) parts.push(`Repository: ${repoUrl}`)

  if (email) {
    parts.push('')
    parts.push('=== EMAIL RUNTIME ===')
    parts.push(`Current mailbox account filter: ${email.accountId || 'all'}`)
    parts.push(`Current folder: ${email.folder || 'Inbox'}`)
    parts.push(`Current search query: ${email.query || '(none)'}`)
    parts.push(`Selected message id: ${email.selectedMessage?.id || '(none)'}`)
    parts.push('Accounts:')
    parts.push(summarizeAccounts(email.accounts))
    parts.push('Loaded messages:')
    parts.push(summarizeMessages(email.messages))

    if (email.selectedMessage) {
      parts.push('Selected message:')
      parts.push(`- Subject: ${email.selectedMessage.subject || '(no subject)'}`)
      parts.push(`- From: ${email.selectedMessage.from || 'unknown sender'}`)
      parts.push(`- To: ${(email.selectedMessage.to || []).join(', ') || '(unknown)'}`)
      parts.push(`- Thread id: ${email.selectedMessage.threadId || '(unknown)'}`)
    }
  }

  return parts.join('\n')
}

export function getAppManifest() {
  return APP_MANIFEST
}
