import { useCallback, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { currentModelSupportsTools, sendConversation, sendWithTools } from '../../integrations/gemini-api/geminiService'
import { appendConversation, buildFullContext } from '../../integrations/ai-memory/aiMemoryService'
import { buildRuntimeAppContext } from '../../integrations/gemini-api/appContext'
import { createEmailToolExecutor, emailToolDeclarations } from '../../integrations/gemini-api/emailTools'

const EMAIL_SYSTEM_PROMPT = `You are the email copilot inside Daniel's Command Center.

You must work with the actual connected email accounts loaded in the app right now. Never invent messages, inbox state, senders, folders, or account details.

When the user asks about email, inspect the real mailbox state using the available tools before answering. When the user asks you to take an email action, use the tools to do it. After any action, briefly confirm what changed.

Be concise, practical, and specific. If a message is ambiguous, refer to it by sender and subject or ask for a smaller clarification only when strictly necessary.`

export function useEmailAI(mail) {
  const { sheetIds } = useAuth()
  const [chatHistory, setChatHistory] = useState([])
  const [chatLoading, setChatLoading] = useState(false)

  const executeTool = useMemo(() => createEmailToolExecutor(mail), [mail])

  const ask = useCallback(async (userMessage) => {
    if (!userMessage.trim() || chatLoading) return ''

    const userTurn = { role: 'user', text: userMessage }
    setChatHistory(prev => [...prev, userTurn])
    setChatLoading(true)

    try {
      const memory = sheetIds
        ? await buildFullContext(sheetIds, { includeRecentConversation: true, recentLimit: 8 }).catch(() => '')
        : ''

      const appContext = buildRuntimeAppContext({
        world: 'work',
        route: window.location.pathname,
        email: mail,
      })

      const systemPrompt = [
        EMAIL_SYSTEM_PROMPT,
        appContext ? `=== APP STATE ===\n${appContext}` : '',
        memory ? `=== AI MEMORY ===\n${memory}` : '',
      ].filter(Boolean).join('\n\n')

      const history = [...chatHistory, userTurn].map(turn => ({ role: turn.role, text: turn.text }))
      const response = currentModelSupportsTools()
        ? await sendWithTools(systemPrompt, history, emailToolDeclarations, executeTool)
        : await sendConversation(`${systemPrompt}\n\n=== LIVE MAILBOX SNAPSHOT ===\n${buildEmailContextText(mail)}`, history)

      const assistantTurn = { role: 'model', text: response }
      setChatHistory(prev => [...prev, assistantTurn])

      if (sheetIds) {
        await appendConversation(sheetIds, 'user', userMessage, 'work').catch(() => {})
        await appendConversation(sheetIds, 'assistant', response, 'work').catch(() => {})
      }

      return response
    } catch (error) {
      const message = error.message === 'GEMINI_NO_KEY'
        ? 'Gemini API key not configured.'
        : `Gemini error: ${error.message}`

      setChatHistory(prev => [...prev, { role: 'model', text: message }])
      return message
    } finally {
      setChatLoading(false)
    }
  }, [chatHistory, chatLoading, executeTool, mail, sheetIds])

  return {
    chatHistory,
    chatLoading,
    ask,
  }
}

function buildEmailContextText(mail) {
  if (!mail?.messages?.length) return 'No live messages loaded.'
  const recent = mail.messages.slice(0, 20)
  return [
    `Accounts: ${(mail.accounts || []).map(a => a.address || a.label).join(', ')}`,
    `Folder: ${mail.folder || 'Inbox'}`,
    `Recent messages (${recent.length}):`,
    ...recent.map((m, i) => `${i + 1}. ${m.folder} | From: ${m.from} | Subject: ${m.subject}${m.read ? '' : ' [UNREAD]'} | ${new Date(m.receivedAt).toLocaleString()}`),
  ].join('\n')
}
