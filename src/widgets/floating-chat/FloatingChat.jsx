import { useState, useRef, useEffect } from 'react'
import { useGemini } from '../../shared/hooks/useGemini'
import AriaFace, { getAriaMood } from '../aria-face/AriaFace'
import styles from './FloatingChat.module.css'

export default function FloatingChat({ world = 'homebase' }) {
  const { chat, chatHistory, chatLoading } = useGemini(world)
  const [open, setOpen]     = useState(false)
  const [input, setInput]   = useState('')
  const bottomRef           = useRef(null)
  const inputRef            = useRef(null)
  const latestText = chatHistory.length ? chatHistory[chatHistory.length - 1].text : ''
  const mood = getAriaMood(latestText, chatLoading, world)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, open])

  // Focus input when chat opens
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

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
    <>
      {/* Floating button */}
      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Toggle Gemini chat"
      >
        <span className={styles.fabIcon}>{open ? '✕' : '✦'}</span>
        {!open && <span className={styles.fabLabel}>AI</span>}
      </button>

      {/* Chat drawer */}
      {open && (
        <>
          <div className={styles.faceScreen}>
            <AriaFace mood={mood} size="xl" label="Q.U.B.E." />
            <div className={styles.faceScreenMeta}>
              <span className={styles.drawerTitle}>Q.U.B.E.</span>
              <span className={styles.drawerSub}>QUANTUM UTILITY & BANTER ENGINE</span>
              <span className={styles.drawerModel}>GEMINI 2.5 FLASH • {chatLoading ? 'THINKING' : mood.toUpperCase()}</span>
            </div>
          </div>

          <div className={styles.drawer}>
          <div className={styles.messages}>
            {chatHistory.length === 0 && (
              <div className={styles.emptyState}>
                Ask me anything about your worlds — tasks, schedule, habits, goals.
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={msg.role === 'user' ? styles.userMsg : styles.aiMsg}
              >
                {msg.role !== 'user' && <span className={styles.aiLabel}>AI</span>}
                <div className={styles.msgText}>
                  {msg.text.split('\n').map((line, j) => {
                    if (!line.trim()) return null
                    const isBullet = /^[•\-*]/.test(line) || /^\d+\./.test(line)
                    const text = line.replace(/^[•\-*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/\*\*/g, '')
                    return isBullet
                      ? <p key={j} className={styles.msgBullet}><span>▸</span>{text}</p>
                      : <p key={j}>{line.replace(/\*\*/g, '')}</p>
                  })}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className={styles.aiMsg}>
                <span className={styles.aiLabel}>AI</span>
                <div className={styles.typingIndicator}>
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message Gemini..."
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
        </>
      )}
    </>
  )
}
