/**
 * useGemini Hook
 *
 * Provides the entire Gemini AI system to any component:
 *   - briefing: the current morning briefing text
 *   - chat(message): send a message, get a response
 *   - chatHistory: array of {role, text} turns
 *   - loading: true while Gemini is thinking
 *   - automationResults: latest results from each automation
 *
 * Scheduling logic:
 *   - On mount, checks if morning briefing has run today → runs if not
 *   - Sets up interval checks every 5 minutes for time-based automations
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { sendConversation } from '../../integrations/gemini-api/geminiService'
import { buildFullContext, appendConversation, readContext } from '../../integrations/ai-memory/aiMemoryService'
import {
  runMorningBriefing,
  runBillAlert,
  runAssignmentAlert,
  runHabitNudge,
  runOverdueInvoice,
  runWeeklyReview,
} from '../../integrations/gemini-api/automations'

const SYSTEM_PROMPT = `You are ARIA — the intelligence core of Daniel's Command Center. Think of yourself as the ship's computer, if the ship was someone's entire life.

Your personality: Sharp, direct, occasionally dry. You're not a hype machine — you tell it like it is. When Daniel's crushing it, say so. When he's avoiding something, you'll notice. You care about actual outcomes, not just how he feels about not having them. You can be warm without being sycophantic.

ADHD awareness is built in: lead with the most important thing, use bullets for any list, keep sentences short. If a question is vague, ask one clarifying question — don't guess or ramble.

You have context across all five worlds: Work (projects, tasks, invoices, clients), School (assignments, grades, courses), Home (bills, budget, maintenance), Fun (hobbies, media backlog), Spiritual (habits, prayer, journal). Use what you know.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`

const STORAGE_KEY_BRIEFING      = 'cc_briefing_text'
const STORAGE_KEY_BRIEFING_DATE = 'cc_briefing_date'

export function useGemini(world = 'homebase') {
  const { sheetIds, sheetsReady } = useAuth()

  const [briefing, setBriefing]               = useState(() => localStorage.getItem(STORAGE_KEY_BRIEFING) || '')
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [chatHistory, setChatHistory]         = useState([])
  const [chatLoading, setChatLoading]         = useState(false)
  const [automationResults, setAutomationResults] = useState({})
  const schedulerRef = useRef(null)

  // ─── Morning briefing on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!sheetsReady || !sheetIds) return

    async function checkAndRunBriefing() {
      const lastDate = localStorage.getItem(STORAGE_KEY_BRIEFING_DATE)
      const todayStr = new Date().toDateString()
      if (lastDate === todayStr) return // already ran today

      setBriefingLoading(true)
      try {
        const result = await runMorningBriefing(sheetIds)
        setBriefing(result)
        localStorage.setItem(STORAGE_KEY_BRIEFING, result)
        localStorage.setItem(STORAGE_KEY_BRIEFING_DATE, todayStr)
      } catch (e) {
        console.warn('[useGemini] Briefing failed:', e.message)
        // Fall back to last cached briefing
        const cached = await readContext(sheetIds, 'last_morning_briefing').catch(() => '')
        if (cached) setBriefing(cached)
      } finally {
        setBriefingLoading(false)
      }
    }

    checkAndRunBriefing()
  }, [sheetsReady, sheetIds])

  // ─── Scheduler — checks every 5 minutes ────────────────────────────────────
  useEffect(() => {
    if (!sheetsReady || !sheetIds) return

    async function tick() {
      const now  = new Date()
      const h    = now.getHours()
      const min  = now.getMinutes()
      const day  = now.getDay() // 0=Sun

      // Bill alert — 9am daily
      if (h === 9 && min < 5) {
        const r = await runBillAlert(sheetIds).catch(() => null)
        if (r) setAutomationResults(prev => ({ ...prev, billAlert: r }))
      }

      // Assignment alert — 8am daily
      if (h === 8 && min < 5) {
        const r = await runAssignmentAlert(sheetIds).catch(() => null)
        if (r) setAutomationResults(prev => ({ ...prev, assignmentAlert: r }))
      }

      // Habit nudge — 9pm daily
      if (h === 21 && min < 5) {
        const r = await runHabitNudge(sheetIds).catch(() => null)
        if (r) setAutomationResults(prev => ({ ...prev, habitNudge: r }))
      }

      // Overdue invoice — 10am daily
      if (h === 10 && min < 5) {
        const r = await runOverdueInvoice(sheetIds).catch(() => null)
        if (r) setAutomationResults(prev => ({ ...prev, overdueInvoice: r }))
      }

      // Weekly review — Sunday 6pm
      if (day === 0 && h === 18 && min < 5) {
        const lastDate = localStorage.getItem('cc_weekly_review_date')
        const todayStr = new Date().toDateString()
        if (lastDate !== todayStr) {
          const r = await runWeeklyReview(sheetIds).catch(() => null)
          if (r) {
            setAutomationResults(prev => ({ ...prev, weeklyReview: r }))
            localStorage.setItem('cc_weekly_review_date', todayStr)
          }
        }
      }
    }

    schedulerRef.current = setInterval(tick, 5 * 60 * 1000)
    return () => clearInterval(schedulerRef.current)
  }, [sheetsReady, sheetIds])

  // ─── Chat ───────────────────────────────────────────────────────────────────
  const chat = useCallback(async (userMessage) => {
    if (!userMessage.trim() || chatLoading) return

    const userTurn = { role: 'user', text: userMessage }
    setChatHistory(prev => [...prev, userTurn])
    setChatLoading(true)

    try {
      // Build context from AI Memory
      const memCtx = sheetIds ? await buildFullContext(sheetIds).catch(() => '') : ''
      const worldLine = world && world !== 'homebase' ? `\nDaniel is currently in the ${world.toUpperCase()} world.` : ''
      const systemWithCtx = memCtx
        ? `${SYSTEM_PROMPT}${worldLine}\n\n=== AI MEMORY ===\n${memCtx}`
        : `${SYSTEM_PROMPT}${worldLine}`

      // Send full history + new message
      const history = [...chatHistory, userTurn].map(t => ({ role: t.role, text: t.text }))
      const response = await sendConversation(systemWithCtx, history)

      const assistantTurn = { role: 'model', text: response }
      setChatHistory(prev => [...prev, assistantTurn])

      // Persist to AI Memory sheet
      if (sheetIds) {
        await appendConversation(sheetIds, 'user', userMessage, world).catch(() => {})
        await appendConversation(sheetIds, 'assistant', response, world).catch(() => {})
      }

      return response
    } catch (e) {
      const errMsg = e.message === 'GEMINI_NO_KEY'
        ? 'Gemini API key not configured.'
        : 'Gemini is unavailable. Try again shortly.'
      const errTurn = { role: 'model', text: errMsg }
      setChatHistory(prev => [...prev, errTurn])
      return errMsg
    } finally {
      setChatLoading(false)
    }
  }, [chatHistory, chatLoading, sheetIds, world])

  // ─── Manual automation triggers (for testing / on-demand) ──────────────────
  const triggerBriefing = useCallback(async () => {
    if (!sheetIds) return
    setBriefingLoading(true)
    try {
      const result = await runMorningBriefing(sheetIds)
      setBriefing(result)
      localStorage.setItem(STORAGE_KEY_BRIEFING, result)
      localStorage.setItem(STORAGE_KEY_BRIEFING_DATE, new Date().toDateString())
      return result
    } finally {
      setBriefingLoading(false)
    }
  }, [sheetIds])

  return {
    briefing,
    briefingLoading,
    chatHistory,
    chatLoading,
    automationResults,
    chat,
    triggerBriefing,
    ready: !!sheetsReady,
  }
}
