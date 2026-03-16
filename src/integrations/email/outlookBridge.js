const BRIDGE_URL = import.meta.env.VITE_OUTLOOK_BRIDGE_URL || 'http://127.0.0.1:45123'
const BRIDGE_TIMEOUT_MS = 1800

async function bridgeFetch(path, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS)
  let res
  try {
    res = await fetch(`${BRIDGE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
  } finally {
    clearTimeout(timeoutId)
  }
  if (!res.ok) throw new Error(`OUTLOOK_BRIDGE_${res.status}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function outlookBridgeHealth() {
  try {
    return await bridgeFetch('/health')
  } catch {
    return { ok: false, live: false, reason: 'Bridge offline' }
  }
}

export async function outlookListAccounts() {
  return bridgeFetch('/mail/accounts')
}

export async function outlookListMessages({ accountId = 'all', folder = 'Inbox', query = '' } = {}) {
  const params = new URLSearchParams({ accountId, folder, query })
  return bridgeFetch(`/mail/messages?${params.toString()}`)
}

export async function outlookGetThread(threadId) {
  const params = new URLSearchParams({ threadId })
  return bridgeFetch(`/mail/thread?${params.toString()}`)
}

export async function outlookMarkRead(messageId, read = true) {
  return bridgeFetch('/mail/mark-read', {
    method: 'POST',
    body: JSON.stringify({ messageId, read }),
  })
}

export async function outlookMoveMessage(messageId, folder) {
  return bridgeFetch('/mail/move', {
    method: 'POST',
    body: JSON.stringify({ messageId, folder }),
  })
}

export async function outlookArchiveMessage(messageId) {
  return bridgeFetch('/mail/archive', {
    method: 'POST',
    body: JSON.stringify({ messageId }),
  })
}

export async function outlookDeleteMessage(messageId) {
  return bridgeFetch('/mail/delete', {
    method: 'POST',
    body: JSON.stringify({ messageId }),
  })
}

export async function outlookComposeMessage(payload) {
  return bridgeFetch('/mail/compose', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function outlookReplyToMessage(messageId, payload) {
  return bridgeFetch('/mail/reply', {
    method: 'POST',
    body: JSON.stringify({ messageId, ...payload }),
  })
}

export async function outlookForwardMessage(messageId, payload) {
  return bridgeFetch('/mail/forward', {
    method: 'POST',
    body: JSON.stringify({ messageId, ...payload }),
  })
}

export function getOutlookBridgeUrl() {
  return BRIDGE_URL
}
