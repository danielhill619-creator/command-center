import { useState, useRef, useEffect } from 'react'
import { useGemini } from '../../shared/hooks/useGemini'
import { useOptionalMailCenter } from '../../shared/hooks/useMailCenter'
import styles from './FloatingChat.module.css'

function GeminiIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gem-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#4285f4" />
          <stop offset="50%"  stopColor="#9b72cb" />
          <stop offset="100%" stopColor="#d96570" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C12 2 12 9 19 12C12 15 12 22 12 22C12 22 12 15 5 12C12 9 12 2 12 2Z"
        fill="url(#gem-grad)"
      />
    </svg>
  )
}

function renderLines(text) {
  return text.split('\n').filter(l => l.trim()).map((line, j) => {
    const isBullet = /^[•\-*]/.test(line) || /^\d+\./.test(line)
    const clean = line.replace(/^[•\-*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/\*\*/g, '')
    if (isBullet) return (
      <p key={j} className={styles.bullet}><span>▸</span>{clean}</p>
    )
    return <p key={j}>{line.replace(/\*\*/g, '')}</p>
  })
}

export default function FloatingChat({ world = 'homebase' }) {
  const mail = useOptionalMailCenter()
  const { chat, chatHistory, chatLoading } = useGemini(world, { email: mail })
  const [open, setOpen]   = useState(false)
  const [input, setInput] = useState('')
  const bottomRef         = useRef(null)
  const inputRef          = useRef(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
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
      {/* FAB */}
      <button
        className={`${styles.fab} ${open ? styles.fabActive : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Toggle Gemini chat"
        title="Gemini AI"
      >
        {open
          ? <span className={styles.closeX}>✕</span>
          : <GeminiIcon size={22} />
        }
      </button>

      {/* Floating window */}
      <div className={`${styles.window} ${open ? styles.windowOpen : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <GeminiIcon size={16} />
            <span className={styles.headerTitle}>Gemini</span>
          </div>
          <button className={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
        </div>

        {/* Messages */}
        <div className={styles.messages}>
          {chatHistory.length === 0 && (
            <div className={styles.emptyState}>
              <GeminiIcon size={32} />
              <p>{mail ? 'Ask me about your worlds, live inbox, projects, or what needs attention.' : 'Ask me anything — tasks, schedule, your worlds, or anything else.'}</p>
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? styles.userMsg : styles.aiMsg}>
              {msg.role !== 'user' && (
                <div className={styles.aiAvatar}><GeminiIcon size={13} /></div>
              )}
              <div className={styles.msgText}>{renderLines(msg.text)}</div>
            </div>
          ))}
          {chatLoading && (
            <div className={styles.aiMsg}>
              <div className={styles.aiAvatar}><GeminiIcon size={13} /></div>
              <div className={styles.typing}><span /><span /><span /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className={styles.inputRow}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Gemini..."
            rows={1}
            disabled={chatLoading}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!input.trim() || chatLoading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
