import { useState, useRef, useEffect } from 'react'
import { useGemini } from '../../shared/hooks/useGemini'
import AriaFace, { getAriaMood } from '../aria-face/AriaFace'
import styles from './QubePanel.module.css'

export default function QubePanel({ world = 'homebase' }) {
  const { chat, chatHistory, chatLoading } = useGemini(world)
  const [input,  setInput]  = useState('')
  const bottomRef            = useRef(null)
  const inputRef             = useRef(null)

  const latestText = chatHistory.length
    ? chatHistory[chatHistory.length - 1].text
    : ''
  const mood = getAriaMood(latestText, chatLoading, world)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function handleSend() {
    const msg = input.trim()
    if (!msg || chatLoading) return
    setInput('')
    await chat(msg)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={styles.panel}>

      {/* ── Face + identity header ── */}
      <div className={styles.faceRow}>
        <AriaFace mood={mood} size="xl" label="Q.U.B.E." />
        <div className={styles.identity}>
          <span className={styles.name}>Q.U.B.E.</span>
          <span className={styles.fullName}>QUANTUM UTILITY & BANTER ENGINE</span>
          <span className={styles.moodTag}>{chatLoading ? 'THINKING...' : mood.toUpperCase()}</span>
        </div>
      </div>

      {/* ── Chat messages ── */}
      <div className={styles.messages}>
        {chatHistory.length === 0 && (
          <div className={styles.empty}>
            Q.U.B.E. is online. Ask anything about your worlds.
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={msg.role === 'user' ? styles.userMsg : styles.aiMsg}
          >
            {msg.role !== 'user' && (
              <span className={styles.aiTag}>Q.U.B.E.</span>
            )}
            <div className={styles.msgText}>
              {msg.text.split('\n').map((line, j) => {
                if (!line.trim()) return null
                const isBullet = /^[•\-*]/.test(line) || /^\d+\./.test(line)
                const text = line
                  .replace(/^[•\-*]\s*/, '')
                  .replace(/^\d+\.\s*/, '')
                  .replace(/\*\*/g, '')
                return isBullet
                  ? <p key={j} className={styles.bullet}><span>▸</span>{text}</p>
                  : <p key={j}>{line.replace(/\*\*/g, '')}</p>
              })}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className={styles.aiMsg}>
            <span className={styles.aiTag}>Q.U.B.E.</span>
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
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message Q.U.B.E...."
          rows={1}
          disabled={chatLoading}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim() || chatLoading}
        >
          ▶
        </button>
      </div>
    </div>
  )
}
