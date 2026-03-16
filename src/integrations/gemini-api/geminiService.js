/**
 * Gemini API Service
 *
 * Wraps the Gemini REST API.
 * All calls go through sendMessage() — pass a system prompt + user message.
 * No SDK dependency — pure fetch.
 */

const MODEL_STORAGE_KEY = 'cc_gemini_model_v1'
const USAGE_STORAGE_KEY = 'cc_gemini_usage_v1'
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite-preview'
const GEMINI_USAGE_EVENT = 'cc:gemini-usage-updated'
const GEMINI_MODEL_EVENT = 'cc:gemini-model-updated'

function isToolCapableModel(model) {
  const name = (typeof model === 'string' ? model : model?.name || '').replace('models/', '')
  if (!name) return false
  // Exclude non-generative models regardless of family
  if (/tts|image|embedding|robotics|nano-banana/i.test(name)) return false
  // Exclude tiny Gemma variants not suitable for tool use
  if (/gemma-3-1b|gemma-2-2b|gemma-.*nano/i.test(name)) return false
  // Allow all Gemini and Gemma instruction-tuned models
  return /gemini|gemma|deep-research|computer-use/i.test(name)
}

/**
 * Returns true if the currently selected model supports function/tool calling.
 * Gemma models support generateContent but NOT tool declarations via the Gemini API.
 */
export function currentModelSupportsTools() {
  const name = getGeminiModel()
  return !/^gemma/i.test(name)
}

function getGeminiModel() {
  return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_GEMINI_MODEL
}

export function getSelectedGeminiModel() {
  return getGeminiModel()
}

export function setSelectedGeminiModel(model) {
  if (!isToolCapableModel(model)) return
  localStorage.setItem(MODEL_STORAGE_KEY, model)
  window.dispatchEvent(new CustomEvent(GEMINI_MODEL_EVENT, { detail: { model } }))
}

function getGeminiBase() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`
}

function readUsageStore() {
  try {
    return JSON.parse(localStorage.getItem(USAGE_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeUsageStore(value) {
  localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent(GEMINI_USAGE_EVENT, { detail: value }))
}

function recordUsage(model, usageMetadata = {}) {
  const store = readUsageStore()
  const current = store[model] || {
    requests: 0,
    promptTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    lastUsedAt: null,
    lastError: '',
  }

  store[model] = {
    ...current,
    requests: current.requests + 1,
    promptTokens: current.promptTokens + (usageMetadata.promptTokenCount || 0),
    outputTokens: current.outputTokens + (usageMetadata.candidatesTokenCount || 0),
    totalTokens: current.totalTokens + (usageMetadata.totalTokenCount || 0),
    lastUsedAt: new Date().toISOString(),
    lastError: '',
  }

  writeUsageStore(store)
}

function recordError(model, errorMessage) {
  const store = readUsageStore()
  const current = store[model] || {
    requests: 0,
    promptTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    lastUsedAt: null,
    lastError: '',
  }

  store[model] = {
    ...current,
    lastError: errorMessage,
  }

  writeUsageStore(store)
}

export function getGeminiUsageStats() {
  return readUsageStore()
}

export function subscribeToGeminiUsage(callback) {
  function emitUsage() {
    callback(getGeminiUsageStats())
  }

  function handleStorage(event) {
    if (event.key === USAGE_STORAGE_KEY) emitUsage()
    if (event.key === MODEL_STORAGE_KEY) callback(getGeminiUsageStats(), getSelectedGeminiModel())
  }

  window.addEventListener(GEMINI_USAGE_EVENT, emitUsage)
  window.addEventListener(GEMINI_MODEL_EVENT, emitUsage)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(GEMINI_USAGE_EVENT, emitUsage)
    window.removeEventListener(GEMINI_MODEL_EVENT, emitUsage)
    window.removeEventListener('storage', handleStorage)
  }
}

export async function listAvailableGeminiModels() {
  const apiKey = getApiKey()
  if (!apiKey || apiKey === 'PLACEHOLDER') throw new Error('GEMINI_NO_KEY')

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini API error ${res.status}: ${err?.error?.message ?? res.statusText}`)
  }

  const data = await res.json()
  return (data.models || [])
    .filter(model => model.supportedGenerationMethods?.includes('generateContent'))
    .filter(isToolCapableModel)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

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
  const model = getGeminiModel()
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

  const res = await fetch(`${getGeminiBase()}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    recordError(model, err?.error?.message ?? res.statusText)
    throw new Error(`Gemini API error ${res.status}: ${err?.error?.message ?? res.statusText}`)
  }

  const data = await res.json()
  recordUsage(model, data?.usageMetadata)
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty response')
  return text.trim()
}

/**
 * Send a message with tool/function calling support.
 * Automatically loops through tool call rounds until Gemini returns a text response.
 *
 * @param {string}   systemPrompt
 * @param {Array}    history       - [{role, parts}] format
 * @param {Array}    tools         - Gemini functionDeclarations array
 * @param {Function} executeTool   - async (name, args) => result
 * @returns {Promise<string>}
 */
export async function sendWithTools(systemPrompt, history, tools, executeTool) {
  const apiKey = getApiKey()
  const model = getGeminiModel()
  if (!apiKey || apiKey === 'PLACEHOLDER') throw new Error('GEMINI_NO_KEY')

  const contents = history.map(t => ({
    role: t.role,
    parts: t.parts ?? [{ text: t.text ?? '' }],
  }))

  for (let round = 0; round < 8; round++) {
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: [{ functionDeclarations: tools }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }

    const res = await fetch(`${getGeminiBase()}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      recordError(model, err?.error?.message ?? res.statusText)
      throw new Error(`Gemini API error ${res.status}: ${err?.error?.message ?? res.statusText}`)
    }

    const data = await res.json()
    recordUsage(model, data?.usageMetadata)
    const parts = data?.candidates?.[0]?.content?.parts ?? []
    contents.push({ role: 'model', parts })

    const calls = parts.filter(p => p.functionCall)
    if (calls.length === 0) {
      return parts.map(p => p.text ?? '').join('').trim()
    }

    // Execute all tool calls in parallel, send responses back
    const responses = await Promise.all(
      calls.map(async ({ functionCall: { name, args } }) => {
        const response = await executeTool(name, args ?? {}).catch(e => ({ error: e.message }))
        return { functionResponse: { name, response } }
      })
    )
    contents.push({ role: 'user', parts: responses })
  }

  return 'I ran into too many steps completing that. Please try a simpler request.'
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
  const model = getGeminiModel()
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

  const res = await fetch(`${getGeminiBase()}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    recordError(model, err?.error?.message ?? res.statusText)
    throw new Error(`Gemini API error ${res.status}: ${err?.error?.message ?? res.statusText}`)
  }

  const data = await res.json()
  recordUsage(model, data?.usageMetadata)
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty response')
  return text.trim()
}
