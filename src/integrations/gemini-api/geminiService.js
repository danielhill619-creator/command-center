/**
 * Gemini API Service
 *
 * Wraps the Gemini 2.5 Flash REST API.
 * All calls go through sendMessage() — pass a system prompt + user message.
 * No SDK dependency — pure fetch.
 */

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_BASE  = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY
}

/**
 * Send a message to Gemini and get a text response back.
 *
 * @param {string} systemPrompt  — Context/instructions for the model
 * @param {string} userMessage   — The actual prompt/question
 * @param {object} [options]
 * @param {number} [options.temperature=0.7]
 * @param {number} [options.maxTokens=1024]
 * @returns {Promise<string>}    — Plain text response
 */
export async function sendMessage(systemPrompt, userMessage, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey || apiKey === 'PLACEHOLDER') {
    throw new Error('GEMINI_NO_KEY')
  }

  const { temperature = 0.7, maxTokens = 1024 } = options

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  }

  const res = await fetch(`${GEMINI_BASE}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini API error ${res.status}: ${err?.error?.message ?? res.statusText}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty response')
  return text.trim()
}

/**
 * Send a multi-turn conversation to Gemini.
 *
 * @param {string} systemPrompt
 * @param {Array<{role:'user'|'model', text:string}>} history
 * @returns {Promise<string>}
 */
export async function sendConversation(systemPrompt, history) {
  const apiKey = getApiKey()
  if (!apiKey || apiKey === 'PLACEHOLDER') {
    throw new Error('GEMINI_NO_KEY')
  }

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: history.map(turn => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 1024,
    },
  }

  const res = await fetch(`${GEMINI_BASE}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini API error ${res.status}: ${err?.error?.message ?? res.statusText}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty response')
  return text.trim()
}
