import { useState, useRef, useEffect } from 'react'
import { useGemini } from '../../shared/hooks/useGemini'
import styles from './FloatingChat.module.css'

export default function FloatingChat({ world = 'homebase' }) {
  const { chat, chatHistory, chatLoading } = useGemini(world)
  const [open, setOpen]     = useState(false)
  const [input, setInput]   = useState('')
  const bottomRef           = useRef(null)
  const inputRef            = useRef(null)

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
        <div className={styles.drawer}>
          <div className={styles.drawerHeader}>
            <span className={styles.drawerIcon}>✦</span>
            <span className={styles.drawerTitle}>COMMAND CENTER AI</span>
            <span className={styles.drawerModel}>GEMINI 2.5 FLASH</span>
          </div>

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
      )}
    </>
  )
}
