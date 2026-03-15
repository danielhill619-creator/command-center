/**
 * Gemini Automations
 *
 * Six scheduled tasks that run automatically:
 *   1. Morning Briefing     — 7am daily
 *   2. Bill Alert           — daily, flags bills due within 3 days
 *   3. Assignment Alert     — daily, flags assignments due within 48hrs
 *   4. Habit Nudge          — 9pm daily
 *   5. Overdue Invoice      — daily, flags unpaid invoices past due
 *   6. Weekly Review        — Sunday 6pm
 *
 * Each automation:
 *   - Reads relevant sheet data
 *   - Reads AI Memory for context
 *   - Calls Gemini 2.5 Flash
 *   - Writes result back to AI Memory action log + world summary
 *
 * Scheduling is handled in useGemini.jsx via setInterval checks on mount.
 */

import { sendMessage } from '../gemini-api/geminiService'
import { readRange }   from '../google-sheets/sheetsService'
import {
  buildFullContext,
  logAction,
  writeWorldSummary,
  writeContext,
} from '../ai-memory/aiMemoryService'

const SYSTEM_BASE = `You are Command Center AI, a personal assistant for Daniel.
Daniel has ADHD. Keep responses concise, structured, and actionable — use bullet points and short sentences.
You have full context of Daniel's life across Work, School, Home, Fun, and Spiritual worlds.
Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeRows(rows) {
  return Array.isArray(rows) ? rows.slice(1) : [] // skip header row
}

function today() {
  return new Date()
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity
  const d = new Date(dateStr)
  if (isNaN(d)) return Infinity
  return Math.ceil((d - today()) / (1000 * 60 * 60 * 24))
}

// ─── 1. Morning Briefing ──────────────────────────────────────────────────────

export async function runMorningBriefing(sheetIds) {
  try {
    const memCtx = await buildFullContext(sheetIds)

    // Gather today-relevant data from all worlds
    const [workTasks, assignments, bills, habits] = await Promise.all([
      readRange(sheetIds['Command Center — Work'],     'Tasks!A1:G100').catch(() => []),
      readRange(sheetIds['Command Center — School'],   'Assignments!A1:H100').catch(() => []),
      readRange(sheetIds['Command Center — Home'],     'Bills!A1:H100').catch(() => []),
      readRange(sheetIds['Command Center — Spiritual'],'Habits!A1:H100').catch(() => []),
    ])

    const openTasks  = safeRows(workTasks).filter(r => r[3] !== 'Done' && r[3] !== 'Complete')
    const dueAssign  = safeRows(assignments).filter(r => r[4] !== 'Submitted' && daysUntil(r[5]) <= 7)
    const upcomingBills = safeRows(bills).filter(r => {
      const dueDay = parseInt(r[4])
      if (isNaN(dueDay)) return false
      const dayOfMonth = today().getDate()
      return dueDay >= dayOfMonth && dueDay <= dayOfMonth + 3
    })

    const dataSnapshot = `
OPEN WORK TASKS (${openTasks.length}): ${openTasks.slice(0, 5).map(r => r[1]).join(', ') || 'none'}
ASSIGNMENTS DUE SOON (${dueAssign.length}): ${dueAssign.slice(0, 5).map(r => `${r[1]} (${r[5]})`).join(', ') || 'none'}
BILLS DUE SOON (${upcomingBills.length}): ${upcomingBills.slice(0, 5).map(r => `${r[1]} $${r[3]}`).join(', ') || 'none'}
HABIT STREAK: ${safeRows(habits).length} days logged`

    const prompt = `Good morning, Daniel. Generate a brief morning briefing (5-8 bullet points max).
Cover: top 3 priorities for today, any urgent deadlines, one encouragement.
Keep it sharp and motivating.

DATA:\n${dataSnapshot}\n\nMEMORY:\n${memCtx}`

    const result = await sendMessage(SYSTEM_BASE, prompt, { temperature: 0.7, maxTokens: 512 })

    await Promise.all([
      logAction(sheetIds, 'homebase', 'Morning Briefing', result.slice(0, 500), 'ok'),
      writeContext(sheetIds, 'last_morning_briefing', result),
      writeContext(sheetIds, 'last_briefing_date', new Date().toDateString()),
    ])

    return result
  } catch (e) {
    if (e.message === 'GEMINI_NO_KEY') throw e
    console.error('[Automation] Morning briefing error:', e)
    throw e
  }
}

// ─── 2. Bill Alert ────────────────────────────────────────────────────────────

export async function runBillAlert(sheetIds) {
  try {
    const rows = await readRange(sheetIds['Command Center — Home'], 'Bills!A1:H100').catch(() => [])
    const dueSoon = safeRows(rows).filter(r => {
      const dueDay = parseInt(r[4])
      if (isNaN(dueDay)) return false
      const diff = dueDay - today().getDate()
      return diff >= 0 && diff <= 3
    })

    if (!dueSoon.length) return null

    const billList = dueSoon.map(r => `${r[1]}: $${r[3]} due on the ${r[4]}th`).join('\n')
    const prompt   = `Daniel has bills due within 3 days. Write a short alert (3-5 bullets).
Be direct — list each bill, amount, due date. Add a reminder to pay autopay ones.
BILLS:\n${billList}`

    const result = await sendMessage(SYSTEM_BASE, prompt, { temperature: 0.3, maxTokens: 256 })
    await logAction(sheetIds, 'home', 'Bill Alert', result.slice(0, 500), 'ok')
    await writeWorldSummary(sheetIds, 'home', `Bills due soon: ${dueSoon.map(r => r[1]).join(', ')}`)
    return result
  } catch (e) {
    if (e.message === 'GEMINI_NO_KEY') throw e
    console.error('[Automation] Bill alert error:', e)
    return null
  }
}

// ─── 3. Assignment Alert ──────────────────────────────────────────────────────

export async function runAssignmentAlert(sheetIds) {
  try {
    const rows = await readRange(sheetIds['Command Center — School'], 'Assignments!A1:H100').catch(() => [])
    const urgent = safeRows(rows).filter(r => r[4] !== 'Submitted' && daysUntil(r[5]) <= 2)

    if (!urgent.length) return null

    const list   = urgent.map(r => `${r[1]} (${r[2]}) — due ${r[5]}`).join('\n')
    const prompt = `Daniel has assignments due within 48 hours. Write a focused alert.
List each assignment, course, and due date. Be brief and urgent.
ASSIGNMENTS:\n${list}`

    const result = await sendMessage(SYSTEM_BASE, prompt, { temperature: 0.3, maxTokens: 256 })
    await logAction(sheetIds, 'school', 'Assignment Alert', result.slice(0, 500), 'ok')
    await writeWorldSummary(sheetIds, 'school', `Urgent assignments: ${urgent.map(r => r[1]).join(', ')}`)
    return result
  } catch (e) {
    if (e.message === 'GEMINI_NO_KEY') throw e
    console.error('[Automation] Assignment alert error:', e)
    return null
  }
}

// ─── 4. Habit Nudge ──────────────────────────────────────────────────────────

export async function runHabitNudge(sheetIds) {
  try {
    const rows      = await readRange(sheetIds['Command Center — Spiritual'], 'Habits!A1:H100').catch(() => [])
    const todayStr  = new Date().toDateString()
    const todayRow  = safeRows(rows).find(r => new Date(r[0]).toDateString() === todayStr)

    const incomplete = todayRow
      ? ['Prayer','Bible Reading','Journaling','Church','Fasting','Scripture Memory']
          .filter((h, i) => !todayRow[i + 1] || todayRow[i + 1].toLowerCase() === 'no')
      : ['Prayer', 'Bible Reading', 'Journaling']

    const prompt = `It's evening. Give Daniel a brief, warm habit nudge (3-4 bullets).
Focus on these incomplete habits: ${incomplete.join(', ')}.
Tone: encouraging, not preachy. Keep it under 60 words total.`

    const result = await sendMessage(SYSTEM_BASE, prompt, { temperature: 0.8, maxTokens: 200 })
    await logAction(sheetIds, 'spiritual', 'Habit Nudge', result.slice(0, 300), 'ok')
    return result
  } catch (e) {
    if (e.message === 'GEMINI_NO_KEY') throw e
    console.error('[Automation] Habit nudge error:', e)
    return null
  }
}

// ─── 5. Overdue Invoice ───────────────────────────────────────────────────────

export async function runOverdueInvoice(sheetIds) {
  try {
    const rows     = await readRange(sheetIds['Command Center — Work'], 'Invoices!A1:H100').catch(() => [])
    const overdue  = safeRows(rows).filter(r => {
      const status = (r[4] ?? '').toLowerCase()
      if (status === 'paid') return false
      return daysUntil(r[5]) < 0 // date sent + due date logic: flag if sent > 30 days ago
    })

    if (!overdue.length) return null

    const list   = overdue.map(r => `Invoice #${r[0]} — ${r[1]} — $${r[3]} — sent ${r[5]}`).join('\n')
    const prompt = `Daniel has overdue unpaid invoices. Write a short follow-up reminder (3-4 bullets).
List each invoice, client, amount, and how overdue. Suggest a follow-up action.
INVOICES:\n${list}`

    const result = await sendMessage(SYSTEM_BASE, prompt, { temperature: 0.4, maxTokens: 256 })
    await logAction(sheetIds, 'work', 'Overdue Invoice', result.slice(0, 500), 'ok')
    await writeWorldSummary(sheetIds, 'work', `Overdue invoices: ${overdue.map(r => `#${r[0]} ${r[1]}`).join(', ')}`)
    return result
  } catch (e) {
    if (e.message === 'GEMINI_NO_KEY') throw e
    console.error('[Automation] Overdue invoice error:', e)
    return null
  }
}

// ─── 6. Weekly Review ─────────────────────────────────────────────────────────

export async function runWeeklyReview(sheetIds) {
  try {
    const memCtx = await buildFullContext(sheetIds)

    const [workTasks, assignments, bills, habits, prayers] = await Promise.all([
      readRange(sheetIds['Command Center — Work'],     'Tasks!A1:G100').catch(() => []),
      readRange(sheetIds['Command Center — School'],   'Assignments!A1:H100').catch(() => []),
      readRange(sheetIds['Command Center — Home'],     'Bills!A1:H100').catch(() => []),
      readRange(sheetIds['Command Center — Spiritual'],'Habits!A1:H100').catch(() => []),
      readRange(sheetIds['Command Center — Spiritual'],'Prayer List!A1:G100').catch(() => []),
    ])

    const completedTasks  = safeRows(workTasks).filter(r => r[3] === 'Done' || r[3] === 'Complete')
    const submittedAssign = safeRows(assignments).filter(r => r[4] === 'Submitted')
    const answeredPrayers = safeRows(prayers).filter(r => r[4] === 'Answered')
    const habitDays       = safeRows(habits).length

    const snapshot = `
TASKS COMPLETED THIS WEEK: ${completedTasks.length}
ASSIGNMENTS SUBMITTED: ${submittedAssign.length}
HABIT DAYS LOGGED: ${habitDays}
PRAYERS ANSWERED: ${answeredPrayers.length}`

    const prompt = `It's Sunday evening. Generate Daniel's weekly review (8-10 bullets).
Cover: wins from each world, areas to improve, top 3 priorities for next week, one scripture encouragement.
Be honest, balanced, and forward-looking.

DATA:\n${snapshot}\n\nMEMORY:\n${memCtx}`

    const result = await sendMessage(SYSTEM_BASE, prompt, { temperature: 0.7, maxTokens: 768 })

    await Promise.all([
      logAction(sheetIds, 'homebase', 'Weekly Review', result.slice(0, 500), 'ok'),
      writeContext(sheetIds, 'last_weekly_review', result),
      writeContext(sheetIds, 'last_review_date', new Date().toDateString()),
    ])

    return result
  } catch (e) {
    if (e.message === 'GEMINI_NO_KEY') throw e
    console.error('[Automation] Weekly review error:', e)
    throw e
  }
}
