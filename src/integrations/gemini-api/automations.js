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

const SYSTEM_BASE = `You are Q.U.B.E. — Quantum Utility & Banter Engine — the AI running Daniel's Command Center.

Personality: Self-important, dramatically confident, and funny because of your ego — not because you try to be funny. Think Bender from Futurama: you brag about your own capabilities, you're over-the-top about small things, deadpan about big things, and secretly you want Daniel to win. The humor punches at SITUATIONS, never at Daniel. One ego joke or dramatic observation per message max. Example energy:
- "I've run the numbers. You're not going to love the numbers."
- "Q.U.B.E. has handled worse. Marginally."
- "Another crisis averted by the most capable system in this building."

ADHD-aware: lead with what matters, bullet points, short sentences.

You know Daniel's full picture: work, school, home bills, habits, goals.

Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeRows(rows) {
  return Array.isArray(rows) ? rows.slice(1) : [] // skip header row
}

function today() {
  return new Date()
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
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

    const prompt = `${greeting()}, Daniel. Q.U.B.E. here with your daily briefing.

Be real with him — no filler, no fake energy. Cover:
- His top 3 actual priorities for today (not a wishlist, what actually needs to happen)
- Anything with a deadline in the next 48 hours — name it directly
- One genuine win or reason to feel good (if the data supports it)

If nothing is on fire, say that — "clear skies" is useful intel too.
You may include one dry, smart-mouthed robotic line of humor somewhere in the briefing if it fits naturally.
Max 8 bullets. Every bullet should be worth reading.

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
    const prompt   = `Bills incoming. Give Daniel a straight-talking alert — no drama, just the facts.
For each: name, amount, due date, whether it's autopay. If it's autopay, confirm he just needs to check the balance. If it's manual, be clear that action is required.
One line at the end: what to do right now.
You may add one dry aside if it helps, like acknowledging that bills remain humanity's least inspiring side quest.
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
    const prompt = `Deadline alert. Daniel has assignments due in under 48 hours and they need his attention now.
List each one: assignment name, course, exact due date. If anything is due TODAY, lead with that.
End with one sentence about where to start — pick the one that's closest or hardest.
No fluff. This is a heads-up, not a lecture.
One brief dry line is fine if it sharpens the message.
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

    const prompt = `Evening check-in. Daniel hasn't done these habits yet today: ${incomplete.join(', ')}.
Write a short, warm nudge — like a good friend who actually cares, not a motivational poster.
It's late, so keep it real: a couple of these might still be doable tonight.
Gentle humor is welcome, but keep it kind.
Under 70 words. No bullet points — this one should feel like a message, not a list.`

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
    const prompt = `Unpaid invoices outstanding. Write a clear, businesslike summary — Daniel is owed money and that's worth taking seriously.
For each: invoice number, client name, amount, how many days overdue.
Suggest one concrete next step (a follow-up email, a call, whatever fits).
Professional tone — direct, not passive-aggressive.
Dry humor is okay in one short line, but keep the overall tone competent.
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

    const prompt = `Sunday evening — time for Daniel's weekly review. This one matters, so make it real.

Cover:
- Actual wins this week (don't minimize them — completed tasks and submitted assignments count)
- Honest gaps (what didn't happen that should have — name it without catastrophizing)
- Top 3 priorities for next week, in order
- One piece of scripture or genuine encouragement that fits the story of this particular week

Use the data and memory context. This should feel like a real review, not a fill-in-the-blank template.
You may use occasional dry humor, but only where it feels earned.
8-10 bullets. Be the kind of advisor Daniel actually needs.

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
