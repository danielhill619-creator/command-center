/**
 * Sheet Initializer
 *
 * Runs once on first login. Checks if each of the 6 spreadsheets exists
 * in the user's Drive. If not, creates it with all tabs and headers.
 *
 * Stores sheet IDs in localStorage so subsequent logins skip the check.
 */

import { findSpreadsheet, createSpreadsheet, initHeaders } from './sheetsService'
import { SHEET_SCHEMAS } from './sheetSchemas'

const STORAGE_KEY = 'cc_sheet_ids'

/**
 * Returns the cached sheet ID map from localStorage, or null.
 * Shape: { 'Command Center — Work': 'spreadsheetId', ... }
 */
export function getCachedSheetIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function cacheSheetIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

/**
 * Ensure a single spreadsheet exists. Creates it if not found.
 * Writes headers to all tabs.
 * Returns the spreadsheet ID.
 */
async function ensureSpreadsheet(name, schema) {
  // Check if already exists in Drive
  let file = await findSpreadsheet(name)

  if (!file) {
    console.log(`[CC] Creating spreadsheet: ${name}`)
    const tabNames = Object.keys(schema.tabs)
    const created = await createSpreadsheet(name, tabNames)
    file = { id: created.spreadsheetId }
  } else {
    console.log(`[CC] Found existing spreadsheet: ${name} (${file.id})`)
  }

  // Write headers to each tab (skips if already present)
  for (const [tabName, headers] of Object.entries(schema.tabs)) {
    await initHeaders(file.id, tabName, headers)
  }

  return file.id
}

/**
 * Main initializer. Call this after successful Google sign-in.
 * Returns a map of { sheetName: spreadsheetId } for all 6 sheets.
 */
export async function initializeSheets() {
  // Return cached IDs if available (avoids Drive API calls on every login)
  const cached = getCachedSheetIds()
  if (cached && Object.keys(cached).length === Object.keys(SHEET_SCHEMAS).length) {
    console.log('[CC] Using cached sheet IDs')
    return cached
  }

  console.log('[CC] Initializing Google Sheets...')
  const ids = {}

  for (const [name, schema] of Object.entries(SHEET_SCHEMAS)) {
    ids[name] = await ensureSpreadsheet(name, schema)
  }

  cacheSheetIds(ids)
  console.log('[CC] Sheets initialized:', ids)
  return ids
}

/**
 * Clear cached sheet IDs (useful if sheets are deleted and need to be recreated).
 */
export function clearSheetCache() {
  localStorage.removeItem(STORAGE_KEY)
}
