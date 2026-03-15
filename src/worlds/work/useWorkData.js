/**
 * useWorkData
 *
 * React hook — reads and writes all Work World data from Google Sheets.
 * Tabs: Projects, Tasks, Clients, Invoices, Income
 *
 * Column order (0-indexed, header row skipped):
 *   Projects:  ID(0), Project Name(1), Client(2), Status(3), Start Date(4), Due Date(5), Description(6), Notes(7)
 *   Tasks:     ID(0), Task(1), Project(2), Status(3), Priority(4), Due Date(5), Notes(6)
 *   Clients:   ID(0), Name(1), Email(2), Phone(3), Company(4), Notes(5)
 *   Invoices:  ID(0), Client(1), Project(2), Amount(3), Status(4), Date Sent(5), Date Paid(6), Notes(7)
 *   Income:    Date(0), Source(1), Amount(2), Category(3), Notes(4)
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'
import { readRange, appendRows, writeRange } from '../../integrations/google-sheets/sheetsService'

const SHEET_NAME = 'Command Center — Work'

function parseRows(rows, mapper) {
  if (!Array.isArray(rows) || rows.length <= 1) return []
  return rows.slice(1).map(mapper).filter(Boolean)
}

function nextId(rows) {
  if (!rows.length) return '1'
  const ids = rows.map(r => parseInt(r[0])).filter(n => !isNaN(n))
  return ids.length ? String(Math.max(...ids) + 1) : '1'
}

export default function useWorkData() {
  const { sheetIds, sheetsReady } = useAuth()

  const [projects,  setProjects]  = useState([])
  const [tasks,     setTasks]     = useState([])
  const [clients,   setClients]   = useState([])
  const [invoices,  setInvoices]  = useState([])
  const [income,    setIncome]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  const sheetId = sheetIds?.[SHEET_NAME]

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!sheetId) return
    setLoading(true)
    setError(null)
    try {
      const [pRows, tRows, cRows, iRows, incRows] = await Promise.all([
        readRange(sheetId, 'Projects!A1:H200'),
        readRange(sheetId, 'Tasks!A1:G200'),
        readRange(sheetId, 'Clients!A1:F200'),
        readRange(sheetId, 'Invoices!A1:H200'),
        readRange(sheetId, 'Income!A1:E200'),
      ])

      setProjects(parseRows(pRows, r => ({
        id: r[0], name: r[1] ?? '', client: r[2] ?? '', status: r[3] ?? 'Active',
        startDate: r[4] ?? '', dueDate: r[5] ?? '', description: r[6] ?? '', notes: r[7] ?? '',
      })))

      setTasks(parseRows(tRows, r => ({
        id: r[0], task: r[1] ?? '', project: r[2] ?? '', status: r[3] ?? 'To Do',
        priority: r[4] ?? 'Medium', dueDate: r[5] ?? '', notes: r[6] ?? '',
      })))

      setClients(parseRows(cRows, r => ({
        id: r[0], name: r[1] ?? '', email: r[2] ?? '', phone: r[3] ?? '',
        company: r[4] ?? '', notes: r[5] ?? '',
      })))

      setInvoices(parseRows(iRows, r => ({
        id: r[0], client: r[1] ?? '', project: r[2] ?? '', amount: r[3] ?? '0',
        status: r[4] ?? 'Unpaid', dateSent: r[5] ?? '', datePaid: r[6] ?? '', notes: r[7] ?? '',
      })))

      setIncome(parseRows(incRows, r => ({
        date: r[0] ?? '', source: r[1] ?? '', amount: r[2] ?? '0',
        category: r[3] ?? '', notes: r[4] ?? '',
      })))
    } catch (e) {
      console.error('[useWorkData] load error:', e)
      setError('Failed to load Work data.')
    } finally {
      setLoading(false)
    }
  }, [sheetId])

  useEffect(() => {
    if (sheetsReady && sheetId) load()
  }, [sheetsReady, sheetId, load])

  // ── Projects ───────────────────────────────────────────────────────────────

  async function addProject(data) {
    const rawRows = await readRange(sheetId, 'Projects!A1:A200').catch(() => [])
    const id = nextId((rawRows ?? []).slice(1))
    await appendRows(sheetId, 'Projects!A:H', [[
      id, data.name, data.client, data.status || 'Active',
      data.startDate || '', data.dueDate || '', data.description || '', data.notes || '',
    ]])
    await load()
  }

  async function updateProjectStatus(id, status) {
    const rawRows = await readRange(sheetId, 'Projects!A1:H200').catch(() => [])
    const idx = (rawRows ?? []).findIndex((r, i) => i > 0 && r[0] === id)
    if (idx < 0) return
    await writeRange(sheetId, `Projects!D${idx + 1}`, [[status]])
    await load()
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async function addTask(data) {
    const rawRows = await readRange(sheetId, 'Tasks!A1:A200').catch(() => [])
    const id = nextId((rawRows ?? []).slice(1))
    await appendRows(sheetId, 'Tasks!A:G', [[
      id, data.task, data.project || '', data.status || 'To Do',
      data.priority || 'Medium', data.dueDate || '', data.notes || '',
    ]])
    await load()
  }

  async function updateTaskStatus(id, status) {
    const rawRows = await readRange(sheetId, 'Tasks!A1:G200').catch(() => [])
    const idx = (rawRows ?? []).findIndex((r, i) => i > 0 && r[0] === id)
    if (idx < 0) return
    await writeRange(sheetId, `Tasks!D${idx + 1}`, [[status]])
    await load()
  }

  // ── Clients ────────────────────────────────────────────────────────────────

  async function addClient(data) {
    const rawRows = await readRange(sheetId, 'Clients!A1:A200').catch(() => [])
    const id = nextId((rawRows ?? []).slice(1))
    await appendRows(sheetId, 'Clients!A:F', [[
      id, data.name, data.email || '', data.phone || '', data.company || '', data.notes || '',
    ]])
    await load()
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  async function addInvoice(data) {
    const rawRows = await readRange(sheetId, 'Invoices!A1:A200').catch(() => [])
    const id = nextId((rawRows ?? []).slice(1))
    await appendRows(sheetId, 'Invoices!A:H', [[
      id, data.client, data.project || '', data.amount,
      data.status || 'Unpaid', data.dateSent || new Date().toLocaleDateString(), '', data.notes || '',
    ]])
    await load()
  }

  async function markInvoicePaid(id) {
    const rawRows = await readRange(sheetId, 'Invoices!A1:H200').catch(() => [])
    const idx = (rawRows ?? []).findIndex((r, i) => i > 0 && r[0] === id)
    if (idx < 0) return
    await writeRange(sheetId, `Invoices!E${idx + 1}:G${idx + 1}`, [['Paid', '', new Date().toLocaleDateString()]])
    await load()
  }

  // ── Income ─────────────────────────────────────────────────────────────────

  async function addIncome(data) {
    await appendRows(sheetId, 'Income!A:E', [[
      data.date || new Date().toLocaleDateString(), data.source,
      data.amount, data.category || 'Freelance', data.notes || '',
    ]])
    await load()
  }

  // ── Revenue summary ────────────────────────────────────────────────────────

  const totalRevenue = income.reduce((sum, r) => sum + parseFloat(r.amount) || 0, 0)
  const pendingInvoicesTotal = invoices
    .filter(i => i.status !== 'Paid')
    .reduce((sum, i) => sum + parseFloat(i.amount) || 0, 0)
  const paidInvoicesTotal = invoices
    .filter(i => i.status === 'Paid')
    .reduce((sum, i) => sum + parseFloat(i.amount) || 0, 0)

  return {
    projects, tasks, clients, invoices, income,
    loading, error, reload: load,
    addProject, updateProjectStatus,
    addTask, updateTaskStatus,
    addClient,
    addInvoice, markInvoicePaid,
    addIncome,
    totalRevenue, pendingInvoicesTotal, paidInvoicesTotal,
  }
}
