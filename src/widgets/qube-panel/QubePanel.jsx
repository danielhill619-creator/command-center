import { useState, useRef, useEffect } from 'react'
import { useGemini } from '../../shared/hooks/useGemini'
import useHeadlines from '../../shared/hooks/useHeadlines'
import styles from './QubePanel.module.css'

function renderLines(text) {
  return text.split('\n').filter(l => l.trim()).map((line, j) => {
    const isBullet = /^[•\-*]/.test(line) || /^\d+\./.test(line)
    const clean    = line.replace(/^[•\-*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/\*\*/g, '')
    const isBold   = line.startsWith('**') || line.startsWith('##')
    const text2    = clean.replace(/^#+\s*/, '')
    if (isBold)   return <p key={j} className={styles.boldLine}>{text2}</p>
    if (isBullet) return <p key={j} className={styles.bullet}><span>▸</span>{clean}</p>
    return <p key={j}>{line.replace(/\*\*/g, '')}</p>
  })
}

export default function GeminiPanel({ world = 'homebase' }) {
  const {
    briefing, briefingLoading, triggerBriefing, ready,
    chat, chatHistory, chatLoading,
  } = useGemini(world)

  const { headlines } = useHeadlines()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatHistory, chatLoading])

  function buildNewsContext() {
    if (!headlines.length) return ''
    const items = headlines.slice(0, 15).map((h, i) => `${i + 1}. ${h.title}`).join('\n')
    return `=== LIVE NEWS HEADLINES (${new Date().toLocaleTimeString()}) ===\n${items}`
  }

  async function handleSend() {
    const msg = input.trim()
    if (!msg || chatLoading) return
    setInput('')
    await chat(msg, { extra: buildNewsContext() })
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={styles.panel}>

      {/* ── Messages ── */}
      <div className={styles.messages}>

        {/* Daily briefing */}
        <div className={styles.briefingBlock}>
          <div className={styles.briefingHeader}>
            <span className={styles.briefingLabel}>DAILY BRIEFING</span>
            <button
              className={styles.refreshBtn}
              onClick={triggerBriefing}
              disabled={briefingLoading || !ready}
              title="Refresh briefing"
            >↻</button>
          </div>

          {briefingLoading && (
            <div className={styles.briefingLoading}>
              <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
            </div>
          )}

          {!briefingLoading && !briefing && !ready && (
            <p className={styles.briefingEmpty}>Connecting...</p>
          )}

          {!briefingLoading && !briefing && ready && (
            <p className={styles.briefingEmpty}>
              No briefing yet.{' '}
              <button className={styles.triggerLink} onClick={triggerBriefing}>Generate now</button>
            </p>
          )}

          {briefing && (
            <div className={styles.briefingContent}>
              {renderLines(briefing)}
            </div>
          )}
        </div>

        {/* Chat history */}
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={msg.role === 'user' ? styles.userMsg : styles.aiMsg}
          >
            <div className={styles.msgText}>{renderLines(msg.text)}</div>
          </div>
        ))}

        {chatLoading && (
          <div className={styles.aiMsg}>
            <div className={styles.typing}>
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className={styles.inputRow}>
        <textarea
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything..."
          rows={1}
          disabled={chatLoading || briefingLoading}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim() || chatLoading}
        >▶</button>
      </div>
    </div>
  )
}
