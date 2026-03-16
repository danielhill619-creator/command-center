import { getLiveAccessToken } from './emailAuth'

function gmailHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

function decodeBase64Url(value = '') {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  try {
    return decodeURIComponent(escape(atob(padded + pad)))
  } catch {
    try { return atob(padded + pad) } catch { return '' }
  }
}

function extractBodies(payload, result = { text: '', html: '' }) {
  if (!payload) return result
  const mime = payload.mimeType || ''
  if (mime === 'text/plain' && payload.body?.data)
    result.text = result.text || decodeBase64Url(payload.body.data)
  else if (mime === 'text/html' && payload.body?.data)
    result.html = result.html || decodeBase64Url(payload.body.data)
  else if (payload.body?.data && !mime.startsWith('multipart'))
    result.text = result.text || decodeBase64Url(payload.body.data)
  for (const part of payload.parts || [])
    extractBodies(part, result)
  return result
}

function extractBody(payload) {
  const { text, html } = extractBodies(payload)
  return text || html.replace(/<[^>]+>/g, ' ') || ''
}

function extractHtmlBody(payload) {
  const { html, text } = extractBodies(payload)
  if (html) return html
  // Wrap plain text in basic HTML so iframe renders consistently
  return `<pre style="font-family:sans-serif;font-size:13px;white-space:pre-wrap;word-break:break-word;color:#ddd;background:#1a1a2e;padding:16px;margin:0">${
    text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }</pre>`
}

function headerValue(headers = [], name) {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

function buildFolderQuery(folder) {
  switch (folder) {
    case 'Inbox':
      return 'in:inbox -in:trash'
    case 'Sent':
      return 'in:sent'
    case 'Drafts':
      return 'in:drafts'
    case 'Trash':
      return 'in:trash'
    case 'Archive':
      return '-in:inbox -in:sent -in:drafts -in:trash'
    case 'All Mail':
    default:
      return ''
  }
}

function combineQuery(folder, query) {
  return [buildFolderQuery(folder), query.trim()].filter(Boolean).join(' ').trim()
}

export async function gmailListMessages(account, { folder = 'Inbox', query = '', maxResults = 25 } = {}) {
  const token = await getLiveAccessToken(account)
  if (!token) throw new Error('GMAIL_TOKEN_MISSING — reconnect this account')

  const q = new URLSearchParams({ maxResults: String(maxResults), q: combineQuery(folder, query) })
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${q}`, {
    headers: gmailHeaders(token),
  })

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}))
    const msg = err?.error?.message ?? listRes.statusText
    throw new Error(`Gmail API ${listRes.status}: ${msg}`)
  }

  const list = await listRes.json()
  if (!list.messages?.length) return []

  const messages = await Promise.all(list.messages.map(async row => {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${row.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc`,
      { headers: gmailHeaders(token) }
    )
    if (!res.ok) return null
    const msg = await res.json()
    return gmailNormalizeMessage(account, msg)
  }))

  return messages.filter(Boolean)
}

export function gmailNormalizeMessage(account, msg) {
  const headers = msg.payload?.headers || []
  const labels = msg.labelIds || []
  const folder = labels.includes('TRASH') ? 'Trash'
    : labels.includes('SENT') ? 'Sent'
    : labels.includes('DRAFT') ? 'Drafts'
    : labels.includes('INBOX') ? 'Inbox'
    : labels.includes('UNREAD') ? 'Inbox'
    : 'Archive'

  return {
    id: msg.id,
    accountId: account.id,
    folder,
    threadId: msg.threadId,
    subject: headerValue(headers, 'Subject') || '(no subject)',
    preview: (msg.snippet || '').slice(0, 140),
    from: headerValue(headers, 'From') || account.address,
    to: [headerValue(headers, 'To')].filter(Boolean),
    cc: [headerValue(headers, 'Cc')].filter(Boolean),
    body: msg.payload ? extractBody(msg.payload) : msg.snippet || '',
    htmlBody: msg.payload ? extractHtmlBody(msg.payload) : '',
    receivedAt: new Date(Number(msg.internalDate || Date.now())).toISOString(),
    read: !labels.includes('UNREAD'),
    starred: labels.includes('STARRED'),
    hasAttachments: JSON.stringify(msg.payload || {}).includes('attachmentId'),
    attachments: [],
    live: true,
  }
}

export async function gmailGetThread(account, threadId) {
  const token = await getLiveAccessToken(account)
  if (!token) throw new Error('GMAIL_NOT_CONNECTED')
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: gmailHeaders(token) }
  )
  if (!res.ok) throw new Error(`Gmail thread ${res.status}`)
  const data = await res.json()
  return (data.messages || []).map(msg => gmailNormalizeMessage(account, msg))
}

export async function gmailModifyMessage(account, messageId, addLabelIds = [], removeLabelIds = []) {
  const token = await getLiveAccessToken(account)
  if (!token) throw new Error('GMAIL_NOT_CONNECTED')
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    headers: { ...gmailHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GMAIL_MODIFY_FAILED: ${err?.error?.message || res.statusText}`)
  }
  return true
}

export async function gmailTrashMessage(account, messageId) {
  const token = await getLiveAccessToken(account)
  if (!token) throw new Error('GMAIL_NOT_CONNECTED')
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
    method: 'POST',
    headers: gmailHeaders(token),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GMAIL_TRASH_FAILED: ${err?.error?.message || res.statusText}`)
  }
  return true
}

export async function gmailSendMessage(account, { to, cc = [], subject, body }) {
  const token = await getLiveAccessToken(account)
  if (!token) throw new Error('GMAIL_NOT_CONNECTED')
  const lines = [
    `To: ${to.join(', ')}`,
    cc.length ? `Cc: ${cc.join(', ')}` : null,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].filter(Boolean)
  const raw = btoa(unescape(encodeURIComponent(lines.join('\r\n')))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { ...gmailHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) throw new Error('GMAIL_SEND_FAILED')
  return res.json()
}
