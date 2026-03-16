function truncate(text = '', limit = 1200) {
  if (!text) return ''
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function buildThreadSummary(thread = []) {
  if (!thread.length) return []

  return thread.map(message => ({
    id: message.id,
    from: message.from,
    to: message.to || [],
    cc: message.cc || [],
    subject: message.subject,
    receivedAt: message.receivedAt,
    body: truncate(message.body || ''),
  }))
}

function buildMailboxSnapshot(mail) {
  return {
    accountId: mail.accountId,
    folder: mail.folder,
    query: mail.query,
    accounts: mail.accounts.map(account => ({
      id: account.id,
      label: account.label,
      address: account.address,
      provider: account.provider,
      connected: !!account.connected,
    })),
    messages: mail.messages.slice(0, 12).map(message => ({
      id: message.id,
      accountId: message.accountId,
      threadId: message.threadId,
      from: message.from,
      subject: message.subject,
      preview: message.preview,
      folder: message.folder,
      read: !!message.read,
      receivedAt: message.receivedAt,
    })),
    selectedMessage: mail.selectedMessage
      ? {
          id: mail.selectedMessage.id,
          accountId: mail.selectedMessage.accountId,
          threadId: mail.selectedMessage.threadId,
          from: mail.selectedMessage.from,
          to: mail.selectedMessage.to || [],
          cc: mail.selectedMessage.cc || [],
          subject: mail.selectedMessage.subject,
          body: truncate(mail.selectedMessage.body || ''),
        }
      : null,
    selectedThread: buildThreadSummary(mail.selectedThread),
  }
}

function resolveMessage(mail, args = {}) {
  const messageId = args.messageId || mail.selectedMessage?.id
  if (!messageId) throw new Error('No message is selected and no messageId was provided.')

  const message = mail.messages.find(row => row.id === messageId) || mail.selectedThread.find(row => row.id === messageId)
  if (!message) throw new Error(`Message ${messageId} is not in the current mailbox view.`)
  return message
}

export const emailToolDeclarations = [
  {
    name: 'get_mailbox_snapshot',
    description: 'Get the currently loaded mailbox state, connected accounts, visible messages, and selected thread.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'refresh_mailbox',
    description: 'Refresh the current mailbox view from the connected email providers.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'select_message',
    description: 'Select a message from the currently loaded message list by message id.',
    parameters: {
      type: 'OBJECT',
      properties: {
        messageId: { type: 'STRING', description: 'The message id from the current mailbox snapshot.' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'archive_message',
    description: 'Archive the selected message or the provided message id.',
    parameters: {
      type: 'OBJECT',
      properties: {
        messageId: { type: 'STRING', description: 'Optional message id. Uses the selected message when omitted.' },
      },
    },
  },
  {
    name: 'delete_message',
    description: 'Move the selected message or the provided message id to trash.',
    parameters: {
      type: 'OBJECT',
      properties: {
        messageId: { type: 'STRING', description: 'Optional message id. Uses the selected message when omitted.' },
      },
    },
  },
  {
    name: 'mark_message_read',
    description: 'Mark a message read or unread.',
    parameters: {
      type: 'OBJECT',
      properties: {
        messageId: { type: 'STRING', description: 'Optional message id. Uses the selected message when omitted.' },
        read: { type: 'BOOLEAN', description: 'True to mark read, false to mark unread.' },
      },
      required: ['read'],
    },
  },
  {
    name: 'compose_email',
    description: 'Compose and send a new email from the current or specified connected account.',
    parameters: {
      type: 'OBJECT',
      properties: {
        accountId: { type: 'STRING', description: 'Optional account id to send from.' },
        to: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Recipient email addresses.' },
        cc: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Optional CC addresses.' },
        subject: { type: 'STRING', description: 'The subject line.' },
        body: { type: 'STRING', description: 'The plain text email body.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'reply_to_message',
    description: 'Reply to the selected message or the provided message id.',
    parameters: {
      type: 'OBJECT',
      properties: {
        messageId: { type: 'STRING', description: 'Optional message id. Uses the selected message when omitted.' },
        body: { type: 'STRING', description: 'The reply body.' },
      },
      required: ['body'],
    },
  },
]

export function createEmailToolExecutor(mail) {
  return async function executeTool(name, args = {}) {
    switch (name) {
      case 'get_mailbox_snapshot':
        return buildMailboxSnapshot(mail)

      case 'refresh_mailbox':
        await mail.refresh()
        return { ok: true, snapshot: buildMailboxSnapshot(mail) }

      case 'select_message': {
        const message = resolveMessage(mail, args)
        await mail.selectMessage(message)
        return {
          ok: true,
          selectedMessageId: message.id,
          thread: buildThreadSummary(mail.selectedThread),
        }
      }

      case 'archive_message': {
        const message = resolveMessage(mail, args)
        await mail.archiveMessage(message.id, message.accountId)
        return { ok: true, archivedMessageId: message.id }
      }

      case 'delete_message': {
        const message = resolveMessage(mail, args)
        await mail.deleteMessage(message.id, message.accountId)
        return { ok: true, deletedMessageId: message.id }
      }

      case 'mark_message_read': {
        const message = resolveMessage(mail, args)
        await mail.markRead(message.id, !!args.read)
        return { ok: true, messageId: message.id, read: !!args.read }
      }

      case 'compose_email': {
        const defaultAccountId = mail.accountId === 'all' ? mail.accounts[0]?.id : mail.accountId
        const accountId = args.accountId || defaultAccountId
        if (!accountId) throw new Error('No sending account is available.')

        await mail.composeMessage({
          accountId,
          to: args.to || [],
          cc: args.cc || [],
          subject: args.subject || '',
          body: args.body || '',
        })
        return { ok: true, accountId, to: args.to || [], subject: args.subject || '' }
      }

      case 'reply_to_message': {
        const message = resolveMessage(mail, args)
        await mail.replyToMessage(message.id, { body: args.body || '' })
        return { ok: true, repliedToMessageId: message.id }
      }

      default:
        throw new Error(`Unknown email tool: ${name}`)
    }
  }
}
