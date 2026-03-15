/**
 * AI Memory Service
 *
 * All reads and writes to the "Command Center — AI Memory" Google Sheet.
 * Tabs: Context, Conversation History, Preferences, World Summary, Action Log
 *
 * Last-write-wins strategy — every write stamps a timestamp so conflicts
 * can be identified. Both Gemini instances read before every response.
 */

import { readRange, appendRows, writeRange } from '../google-sheets/sheetsService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now() {
  return new Date().toISOString()
}

function getSheetId(sheetIds) {
  return sheetIds?.['Command Center — AI Memory']
}

// ─── Context tab ─────────────────────────────────────────────────────────────

/**
 * Read the full Context tab and return it as a formatted string for Gemini.
 */
export async function readContext(sheetIds) {
  const id = getSheetId(sheetIds)
  if (!id) return ''
  try {
    const rows = await readRange(id, 'Context!A1:B100')
    if (!rows?.length) return ''
    return rows.map(r => `${r[0] ?? ''}: ${r[1] ?? ''}`).join('\n')
  } catch {
    return ''
  }
}

/**
 * Write a key/value pair to the Context tab (upsert by key).
 */
export async function writeContext(sheetIds, key, value) {
  const id = getSheetId(sheetIds)
  if (!id) return
  try {
    const rows = await readRange(id, 'Context!A1:B100')
    const idx  = (rows ?? []).findIndex(r => r[0] === key)
    if (idx >= 0) {
      // Overwrite existing row (1-indexed, +1 for header offset)
      await writeRange(id, `Context!A${idx + 1}:C${idx + 1}`, [[key, value, now()]])
    } else {
      await appendRows(id, 'Context!A:C', [[key, value, now()]])
    }
  } catch (e) {
    console.error('[AIMemory] writeContext error:', e)
  }
}

// ─── Conversation History tab ─────────────────────────────────────────────────

/**
 * Append a message to Conversation History.
 * @param {string} role  — 'user' | 'assistant' | 'system'
 * @param {string} text
 * @param {string} world — which world the conversation happened in
 */
export async function appendConversation(sheetIds, role, text, world = 'homebase') {
  const id = getSheetId(sheetIds)
  if (!id) return
  try {
    await appendRows(id, 'Conversation History!A:D', [[now(), world, role, text]])
  } catch (e) {
    console.error('[AIMemory] appendConversation error:', e)
  }
}

/**
 * Read the last N conversation turns for context.
 * Returns array of {role, text} for use in sendConversation().
 */
export async function readRecentConversation(sheetIds, limit = 20) {
  const id = getSheetId(sheetIds)
  if (!id) return []
  try {
    const rows = await readRange(id, 'Conversation History!A1:D500')
    if (!rows?.length) return []
    return rows
      .slice(-limit)
      .map(r => ({ role: r[2] === 'assistant' ? 'model' : 'user', text: r[3] ?? '' }))
      .filter(t => t.text)
  } catch {
    return []
  }
}

// ─── Action Log tab ───────────────────────────────────────────────────────────

/**
 * Log an automation action to the Action Log tab.
 * Schema: Timestamp | World | Action | Details | Status
 */
export async function logAction(sheetIds, world, action, details = '', status = 'ok') {
  const id = getSheetId(sheetIds)
  if (!id) return
  try {
    await appendRows(id, 'Action Log!A:E', [[now(), world, action, details, status]])
  } catch (e) {
    console.error('[AIMemory] logAction error:', e)
  }
}

// ─── World Summary tab ────────────────────────────────────────────────────────

/**
 * Write a world's summary snapshot (called after automations run).
 */
export async function writeWorldSummary(sheetIds, world, summary) {
  const id = getSheetId(sheetIds)
  if (!id) return
  try {
    const rows = await readRange(id, 'World Summary!A1:C20')
    const idx  = (rows ?? []).findIndex(r => r[0] === world)
    if (idx >= 0) {
      await writeRange(id, `World Summary!A${idx + 1}:C${idx + 1}`, [[world, summary, now()]])
    } else {
      await appendRows(id, 'World Summary!A:C', [[world, summary, now()]])
    }
  } catch (e) {
    console.error('[AIMemory] writeWorldSummary error:', e)
  }
}

/**
 * Read all world summaries as a formatted string for Gemini context.
 */
export async function readWorldSummaries(sheetIds) {
  const id = getSheetId(sheetIds)
  if (!id) return ''
  try {
    const rows = await readRange(id, 'World Summary!A1:C20')
    if (!rows?.length) return ''
    return rows.map(r => `[${r[0]}] ${r[1] ?? ''}`).join('\n')
  } catch {
    return ''
  }
}

// ─── Preferences tab ─────────────────────────────────────────────────────────

/**
 * Read all preferences as a flat string for Gemini context.
 */
export async function readPreferences(sheetIds) {
  const id = getSheetId(sheetIds)
  if (!id) return ''
  try {
    const rows = await readRange(id, 'Preferences!A1:B50')
    if (!rows?.length) return ''
    return rows.map(r => `${r[0]}: ${r[1] ?? ''}`).join('\n')
  } catch {
    return ''
  }
}

// ─── Full context snapshot ────────────────────────────────────────────────────

/**
 * Build a complete context string for Gemini — combines all memory tabs.
 * Called before every Gemini prompt.
 */
export async function buildFullContext(sheetIds) {
  const [context, worldSummaries, prefs] = await Promise.all([
    readContext(sheetIds),
    readWorldSummaries(sheetIds),
    readPreferences(sheetIds),
  ])

  const parts = []
  if (context)       parts.push(`=== CONTEXT ===\n${context}`)
  if (worldSummaries) parts.push(`=== WORLD SUMMARIES ===\n${worldSummaries}`)
  if (prefs)         parts.push(`=== PREFERENCES ===\n${prefs}`)
  return parts.join('\n\n')
}
