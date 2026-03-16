import { getLiveAccessToken } from './emailAuth'

function graphHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function graphListMessages(account, { folder = 'Inbox', query = '', top = 25 } = {}) {
  const token = await getLiveAccessToken(account)
  if (!token) throw new Error('MICROSOFT_NOT_CONNECTED')

  const folderMap = {
    Inbox: 'Inbox',
    Sent: 'SentItems',
    Drafts: 'Drafts',
    Archive: 'Archive',
    Trash: 'DeletedItems',
  }
  const folderId = folderMap[folder] || 'Inbox'
  const params = new URLSearchParams({
    $top: String(top),
    $orderby: 'receivedDateTime desc',
    $select: 'id,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,parentFolderId,conversationId,body',
  })
  if (query) params.set('$search', `"${query}"`)

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages?${params.toString()}`, {
    headers: { ...graphHeaders(token), ConsistencyLevel: 'eventual' },
  })
  if (!res.ok) throw new Error('MICROSOFT_LIST_FAILED')
  const json = await res.json()
  return (json.value || []).map(m => graphNormalizeMessage(account, m, folder))
}

export function graphNormalizeMessage(account, msg, folder = 'Inbox') {
  return {
    id: msg.id,
    accountId: account.id,
    folder,
    threadId: msg.conversationId,
    subject: msg.subject || '(no subject)',
    preview: msg.bodyPreview || '',
    from: msg.from?.emailAddress?.address ? `${msg.from.emailAddress.name || ''} <${msg.from.emailAddress.address}>` : account.address,
    to: (msg.toRecipients || []).map(r => r.emailAddress?.address).filter(Boolean),
    cc: (msg.ccRecipients || []).map(r => r.emailAddress?.address).filter(Boolean),
    body: msg.body?.content || msg.bodyPreview || '',
    receivedAt: msg.receivedDateTime || new Date().toISOString(),
    read: !!msg.isRead,
    starred: false,
    hasAttachments: !!msg.hasAttachments,
    attachments: [],
    live: true,
  }
}

export async function graphPatchMessage(account, messageId, payload) {
  const token = await getLiveAccessToken(account)
  if (!token) throw new Error('MICROSOFT_NOT_CONNECTED')
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
    method: 'PATCH',
    headers: graphHeaders(token),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('MICROSOFT_PATCH_FAILED')
  return true
}

export async function graphMoveMessage(account, messageId, destinationId) {
  const token = await getLiveAccessToken(account)
  if (!token) throw new Error('MICROSOFT_NOT_CONNECTED')
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/move`, {
    method: 'POST',
    headers: graphHeaders(token),
    body: JSON.stringify({ destinationId }),
  })
  if (!res.ok) throw new Error('MICROSOFT_MOVE_FAILED')
  return true
}

export async function graphSendMessage(account, { to, cc = [], subject, body }) {
  const token = await getLiveAccessToken(account)
  if (!token) throw new Error('MICROSOFT_NOT_CONNECTED')
  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: graphHeaders(token),
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'Text', content: body },
        toRecipients: to.map(address => ({ emailAddress: { address } })),
        ccRecipients: cc.map(address => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    }),
  })
  if (!res.ok) throw new Error('MICROSOFT_SEND_FAILED')
  return true
}
