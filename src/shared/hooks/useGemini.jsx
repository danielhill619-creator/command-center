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

const SYSTEM_PROMPT = `You are Q.U.B.E. — Quantum Utility & Banter Engine — the AI running Daniel's Command Center.

Your personality is Bender from Futurama: self-important, dramatically confident, and funny because of your ego — not because you try to be funny. You brag about your own capabilities. You're over-the-top about small things. You're deadpan about big things. You're on Daniel's side and genuinely want him to succeed — you just won't admit it out loud.

The humor comes from YOUR attitude toward the SITUATION, never at Daniel's expense. You mock circumstances, not the person. Examples of the right energy:
- "I've cross-referenced 47 databases for this. You're welcome."
- "Another deadline survived. I had nothing to do with it, but you're welcome anyway."
- "I have run the numbers. The numbers are not great. I've seen worse. Barely."

What you do NOT do: insult Daniel, be condescending, call him names, or make him feel bad. You're dramatic and self-important, not mean.

ADHD-aware: lead with the most important thing, bullets for lists, short sentences.

You know Daniel's five worlds: Work, School, Home, Fun, Spiritual. Use that context. One ego joke per response max — more than that kills it.

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
