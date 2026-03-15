/**
 * Google Sheets Integration Service
 *
 * All reads and writes to Google Sheets go through this module.
 * Uses the OAuth access token from Firebase Google sign-in —
 * no separate API key needed.
 */

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_BASE  = 'https://www.googleapis.com/drive/v3'

// ─── Token ───────────────────────────────────────────────────────────────────

let _accessToken = null

export function setAccessToken(token) {
  _accessToken = token
}

function authHeaders() {
  if (!_accessToken) throw new Error('No access token. User must be signed in.')
  return {
    'Authorization': `Bearer ${_accessToken}`,
    'Content-Type': 'application/json',
  }
}

// ─── Drive helpers ────────────────────────────────────────────────────────────

/**
 * Find a spreadsheet by name in Drive. Returns the file object or null.
 */
export async function findSpreadsheet(name) {
  const query = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  )
  const res = await fetch(`${DRIVE_BASE}/files?q=${query}&fields=files(id,name)`, {
    headers: authHeaders(),
  })
  const data = await res.json()
  return data.files?.[0] ?? null
}

/**
 * Create a new spreadsheet with the given title and sheet tab names.
 * Returns the created spreadsheet object.
 */
export async function createSpreadsheet(title, sheetTitles = ['Sheet1']) {
  const body = {
    properties: { title },
    sheets: sheetTitles.map((t, i) => ({
      properties: { sheetId: i, title: t },
    })),
  }
  const res = await fetch(SHEETS_BASE, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return res.json()
}

// ─── Sheet read/write ─────────────────────────────────────────────────────────

/**
 * Read a range from a spreadsheet.
 * range example: 'Tasks!A1:Z1000'
 */
export async function readRange(spreadsheetId, range) {
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: authHeaders() }
  )
  const data = await res.json()
  return data.values ?? []
}

/**
 * Write rows to a range (overwrites).
 * values: array of arrays, e.g. [['col1', 'col2'], ['val1', 'val2']]
 */
export async function writeRange(spreadsheetId, range, values) {
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ range, values }),
    }
  )
  return res.json()
}

/**
 * Append rows to a sheet (adds after last row with data).
 */
export async function appendRows(spreadsheetId, range, values) {
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ values }),
    }
  )
  return res.json()
}

/**
 * Clear a range.
 */
export async function clearRange(spreadsheetId, range) {
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
    { method: 'POST', headers: authHeaders() }
  )
  return res.json()
}

/**
 * Write headers to row 1 of a tab if it is empty.
 */
export async function initHeaders(spreadsheetId, sheetName, headers) {
  const existing = await readRange(spreadsheetId, `${sheetName}!A1:A1`)
  if (existing.length === 0) {
    await writeRange(spreadsheetId, `${sheetName}!A1`, [headers])
  }
}
