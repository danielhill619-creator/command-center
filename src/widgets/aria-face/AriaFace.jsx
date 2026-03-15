import { useEffect, useRef, useState } from 'react'
import styles from './AriaFace.module.css'

// ── HUD data ─────────────────────────────────────────────────────────────────

const HUD_LINES = {
  idle:     ['SYSTEM NOMINAL',      'STANDING BY',             'AWAITING INPUT'],
  thinking: ['PROCESSING...',       'CROSS-REFERENCING...',    'COMPUTING RESPONSE'],
  speaking: ['OUTPUT ACTIVE',       'TRANSMITTING',            'VERBAL PROTOCOL'],
  focused:  ['TARGET ACQUIRED',     'EFFICIENCY MODE',         'PRIORITY LOCKED'],
  warning:  ['ANOMALY DETECTED',    'SUBOPTIMAL CONDITIONS',   'INTERVENTION ADVISED'],
  upbeat:   ['POSITIVE OUTCOME',    'METRICS FAVORABLE',       'PERFORMANCE: GOOD'],
  calm:     ['LOW ACTIVITY',        'AMBIENT MODE',            'MINIMAL LOAD'],
}

const HUD_QUOTES = {
  idle:     ['> WAITING ON YOU.', '> SILENCE. NOTED.'],
  thinking: ['> STAND BY...', '> CROSS-REFERENCING DATABASES...'],
  speaking: ['> TRANSMITTING NOW.', '> PARSING OUTPUT...'],
  focused:  ['> LOCKED ON.', '> OBJECTIVE: ACQUIRED.'],
  warning:  ['> THIS COULD HAVE BEEN AVOIDED.', '> ANOTHER PREVENTABLE PROBLEM.'],
  upbeat:   ['> A WIN OCCURRED.', '> RECORDING POSITIVE OUTCOME.'],
  calm:     ['> AMBIENT MODE.', '> ALL CLEAR.'],
}

// ── Mood detection ────────────────────────────────────────────────────────────

export function getAriaMood(text = '', loading = false, world = 'homebase') {
  if (loading) return 'thinking'
  const v = String(text).toLowerCase()
  if (!v.trim()) return world === 'spiritual' ? 'calm' : 'idle'
  if (/(urgent|due|overdue|late|deadline|alert|invoice|bill)/.test(v)) return 'warning'
  if (/(great|win|good job|nice|clear skies|encouragement|answered prayer)/.test(v)) return 'upbeat'
  if (/(plan|focus|priority|start|next|today|task|assignment|schedule)/.test(v)) return 'focused'
  if (/(pray|scripture|habit|journal|peace|rest|grace)/.test(v)) return 'calm'
  return 'speaking'
}

// ── Eye characters per mood ───────────────────────────────────────────────────

const EYE_CHAR = {
  idle:     '◉',
  thinking: '⊙',
  speaking: '●',
  focused:  '⊕',
  warning:  '◉',
  upbeat:   '◉',
  calm:     '◌',
}

// ── Brow endpoints (lx1,ly1,lx2,ly2, rx1,ry1,rx2,ry2) ───────────────────────
// Left brow: x1=outer(left), x2=inner(right). Right brow: x1=inner(left), x2=outer(right)

const BROWS = {
  idle:     [26,60,  80,60,   120,60, 174,60],  // neutral
  thinking: [26,56,  80,60,   120,60, 174,56],  // raised outer edges
  speaking: [26,60,  80,60,   120,60, 174,60],  // neutral
  focused:  [26,54,  80,66,   120,66, 174,54],  // strong V (angry)
  warning:  [26,52,  80,68,   120,68, 174,52],  // very strong V
  upbeat:   [26,54,  80,56,   120,56, 174,54],  // raised
  calm:     [26,62,  80,62,   120,62, 174,62],  // slightly lowered/soft
}

// ── Mouth expressions ─────────────────────────────────────────────────────────

const MOUTH_PATH = {
  idle:     'M 54,145 Q 100,153 146,145',
  thinking: 'M 60,145 L 140,145',
  speaking: 'M 54,144 Q 100,155 146,144',   // base — animated separately
  focused:  'M 54,145 L 146,145',
  warning:  'M 54,145 Q 100,138 146,145',   // frown
  upbeat:   'M 50,143 Q 100,158 150,143',   // wide smile
  calm:     'M 58,146 Q 100,150 142,146',
}

// Speaking animation frames
const SPEAK_PATHS = [
  'M 54,144 Q 100,153 146,144',
  'M 54,143 Q 100,158 146,143',
  'M 54,144 Q 100,162 146,144',
  'M 54,143 Q 100,158 146,143',
  'M 54,144 Q 100,153 146,144',
  'M 54,145 Q 100,148 146,145',
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function AriaFace({ mood = 'idle', size = 'md', label = 'Q.U.B.E.' }) {
  const uid      = useRef(`qb${Math.random().toString(36).slice(2, 7)}`).current
  const timerRef = useRef(null)

  const [blink,      setBlink]      = useState(false)
  const [idx,        setIdx]        = useState(0)
  const [speakFrame, setSpeakFrame] = useState(0)
  const [cursor,     setCursor]     = useState(true)

  // Blink
  useEffect(() => {
    const schedule = () => {
      timerRef.current = setTimeout(() => {
        setBlink(true)
        setTimeout(() => { setBlink(false); schedule() }, 120)
      }, 2600 + Math.random() * 2800)
    }
    schedule()
    return () => clearTimeout(timerRef.current)
  }, [])

  // HUD text cycle
  useEffect(() => {
    setIdx(0)
    const id = setInterval(() => setIdx(p => p + 1), mood === 'thinking' ? 1600 : 3400)
    return () => clearInterval(id)
  }, [mood])

  // Speaking mouth
  useEffect(() => {
    if (mood !== 'speaking') { setSpeakFrame(0); return }
    const id = setInterval(() => setSpeakFrame(p => p + 1), 200)
    return () => clearInterval(id)
  }, [mood])

  // Cursor blink
  useEffect(() => {
    const id = setInterval(() => setCursor(c => !c), 530)
    return () => clearInterval(id)
  }, [])

  const brows = BROWS[mood] ?? BROWS.idle
  const eyeChar = EYE_CHAR[mood] ?? '◉'
  const eyeH  = blink ? 0.05 : 1

  const mouthD = mood === 'speaking'
    ? SPEAK_PATHS[speakFrame % SPEAK_PATHS.length]
    : (MOUTH_PATH[mood] ?? MOUTH_PATH.idle)

  const hudLine  = (HUD_LINES[mood]  ?? HUD_LINES.idle) [idx % HUD_LINES.idle.length]
  const hudQuote = (HUD_QUOTES[mood] ?? HUD_QUOTES.idle)[idx % HUD_QUOTES.idle.length]

  // Pupil offset
  const lOff = { x: mood === 'focused' ? 3 : mood === 'warning' ? -1 : 0,
                 y: mood === 'thinking' ? -6 : mood === 'calm' ? 2 : 0 }
  const rOff = { x: mood === 'focused' ? 3 : mood === 'warning' ?  1 : 0,
                 y: lOff.y }

  const G  = '#00ff41'     // phosphor green
  const Gd = 'rgba(0,255,65,0.45)'   // dim green
  const Gx = 'rgba(0,255,65,0.18)'   // very dim

  return (
    <div className={`${styles.container} ${styles[size]} ${styles[mood]}`}>
      <svg
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
      >
        <defs>
          {/* Screen background gradient */}
          <radialGradient id={`${uid}-scrn`} cx="50%" cy="40%" r="70%">
            <stop offset="0%"   stopColor="#001800" />
            <stop offset="100%" stopColor="#000800" />
          </radialGradient>

          {/* Phosphor glow filter */}
          <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.8" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id={`${uid}-glow2`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>

          {/* CRT screen corner vignette */}
          <radialGradient id={`${uid}-vign`} cx="50%" cy="50%" r="70%">
            <stop offset="50%"  stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>

          {/* Scanline pattern */}
          <pattern id={`${uid}-scan`} x="0" y="0" width="200" height="4" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="200" height="3" fill="transparent" />
            <rect x="0" y="3" width="200" height="1" fill="rgba(0,0,0,0.28)" />
          </pattern>
        </defs>

        {/* ── OUTER BEZEL ── */}
        <rect x="0" y="0" width="200" height="200" rx="6"
          fill="#010a01" />

        {/* ── SCREEN SURFACE ── */}
        <rect x="8" y="8" width="184" height="184" rx="4"
          fill={`url(#${uid}-scrn)`} />

        {/* ── SCREEN EDGE GLOW ── */}
        <rect x="8" y="8" width="184" height="184" rx="4"
          fill="none" stroke={G} strokeWidth="1" strokeOpacity="0.55"
          filter={`url(#${uid}-glow)`} />

        {/* ── TOP STATUS BAR ── */}
        {/* Bar background */}
        <rect x="8" y="8" width="184" height="26" rx="4"
          fill="rgba(0,255,65,0.06)" />
        {/* Title */}
        <text x="100" y="25" textAnchor="middle"
          fontFamily="'Courier New', monospace" fontSize="11" fontWeight="bold"
          fill={G} letterSpacing="3" filter={`url(#${uid}-glow)`}>
          {label}
        </text>
        {/* Top separator */}
        <line x1="8" y1="34" x2="192" y2="34" stroke={G} strokeWidth="1" strokeOpacity="0.5" />

        {/* ── STATUS LABEL (below top bar) ── */}
        <text x="12" y="46" fontFamily="'Courier New', monospace" fontSize="7"
          fill={Gd} letterSpacing="1.2">
          {hudLine}
        </text>

        {/* ── LEFT BROW LINE ── */}
        <line
          x1={brows[0]} y1={brows[1]} x2={brows[2]} y2={brows[3]}
          stroke={G} strokeWidth="2.8" strokeLinecap="square"
          filter={`url(#${uid}-glow)`}
          style={{ transition: 'y1 0.3s, y2 0.3s' }}
        />
        {/* Brow tick marks */}
        <line x1={brows[0]+2} y1={brows[1]+4} x2={brows[0]+2} y2={brows[1]+9}
          stroke={G} strokeWidth="1.5" strokeOpacity="0.6" />
        <line x1={brows[2]-2} y1={brows[3]+4} x2={brows[2]-2} y2={brows[3]+9}
          stroke={G} strokeWidth="1.5" strokeOpacity="0.6" />

        {/* ── RIGHT BROW LINE ── */}
        <line
          x1={brows[4]} y1={brows[5]} x2={brows[6]} y2={brows[7]}
          stroke={G} strokeWidth="2.8" strokeLinecap="square"
          filter={`url(#${uid}-glow)`}
          style={{ transition: 'y1 0.3s, y2 0.3s' }}
        />
        <line x1={brows[4]+2} y1={brows[5]+4} x2={brows[4]+2} y2={brows[5]+9}
          stroke={G} strokeWidth="1.5" strokeOpacity="0.6" />
        <line x1={brows[6]-2} y1={brows[7]+4} x2={brows[6]-2} y2={brows[7]+9}
          stroke={G} strokeWidth="1.5" strokeOpacity="0.6" />

        {/* ── LEFT EYE HOUSING ── */}
        <rect x="22" y="70" width="72" height="46" rx="2"
          fill="rgba(0,255,65,0.04)" stroke={G} strokeWidth="1.8" strokeOpacity="0.9" />
        {/* Corner ticks */}
        <line x1="22" y1="70" x2="32" y2="70" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="22" y1="70" x2="22" y2="80" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="84" y1="70" x2="94" y2="70" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="94" y1="70" x2="94" y2="80" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="22" y1="116" x2="32" y2="116" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="22" y1="106" x2="22" y2="116" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="84" y1="116" x2="94" y2="116" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="94" y1="106" x2="94" y2="116" stroke={G} strokeWidth="3" strokeLinecap="square" />
        {/* Eye glow bg */}
        <ellipse cx="58" cy="93" rx="22" ry="16" fill={Gx} />
        {/* Eye character — blink via scaleY */}
        <g style={{
          transform: `translate(58px,93px) scaleY(${eyeH}) translate(-58px,-93px)`,
          transition: 'transform 0.08s ease',
        }}>
          <text
            x={58 + lOff.x} y={99 + lOff.y}
            textAnchor="middle"
            fontFamily="'Courier New', monospace"
            fontSize="26"
            fill={G}
            filter={`url(#${uid}-glow2)`}
            style={{ transition: 'x 0.2s, y 0.2s' }}
          >
            {eyeChar}
          </text>
        </g>
        {/* Scan line across eye */}
        <line x1="22" y1="93" x2="94" y2="93" stroke={G} strokeWidth="0.6" strokeOpacity="0.2" />

        {/* ── RIGHT EYE HOUSING ── */}
        <rect x="106" y="70" width="72" height="46" rx="2"
          fill="rgba(0,255,65,0.04)" stroke={G} strokeWidth="1.8" strokeOpacity="0.9" />
        <line x1="106" y1="70" x2="116" y2="70" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="106" y1="70" x2="106" y2="80" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="168" y1="70" x2="178" y2="70" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="178" y1="70" x2="178" y2="80" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="106" y1="116" x2="116" y2="116" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="106" y1="106" x2="106" y2="116" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="168" y1="116" x2="178" y2="116" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="178" y1="106" x2="178" y2="116" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <ellipse cx="142" cy="93" rx="22" ry="16" fill={Gx} />
        <g style={{
          transform: `translate(142px,93px) scaleY(${eyeH}) translate(-142px,-93px)`,
          transition: 'transform 0.08s ease',
        }}>
          <text
            x={142 + rOff.x} y={99 + rOff.y}
            textAnchor="middle"
            fontFamily="'Courier New', monospace"
            fontSize="26"
            fill={G}
            filter={`url(#${uid}-glow2)`}
            style={{ transition: 'x 0.2s, y 0.2s' }}
          >
            {eyeChar}
          </text>
        </g>
        <line x1="106" y1="93" x2="178" y2="93" stroke={G} strokeWidth="0.6" strokeOpacity="0.2" />

        {/* ── NOSE BRIDGE ── */}
        <line x1="94" y1="116" x2="100" y2="124" stroke={Gd} strokeWidth="1" />
        <line x1="106" y1="116" x2="100" y2="124" stroke={Gd} strokeWidth="1" />
        <circle cx="100" cy="126" r="1.5" fill={G} fillOpacity="0.5" />

        {/* ── MOUTH HOUSING ── */}
        <rect x="36" y="132" width="128" height="36" rx="2"
          fill="rgba(0,255,65,0.04)" stroke={G} strokeWidth="1.8" strokeOpacity="0.9" />
        {/* Mouth corner ticks */}
        <line x1="36" y1="132" x2="48" y2="132" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="36" y1="132" x2="36" y2="142" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="152" y1="132" x2="164" y2="132" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="164" y1="132" x2="164" y2="142" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="36" y1="168" x2="48" y2="168" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="36" y1="158" x2="36" y2="168" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="152" y1="168" x2="164" y2="168" stroke={G} strokeWidth="3" strokeLinecap="square" />
        <line x1="164" y1="158" x2="164" y2="168" stroke={G} strokeWidth="3" strokeLinecap="square" />

        {/* Expression curve / mouth */}
        <path d={mouthD} fill="none" stroke={G} strokeWidth="2.8"
          strokeLinecap="square" filter={`url(#${uid}-glow2)`} />
        {/* Grille lines above/below expression */}
        <line x1="46" y1="137" x2="154" y2="137" stroke={Gd} strokeWidth="0.9" />
        <line x1="46" y1="163" x2="154" y2="163" stroke={Gd} strokeWidth="0.9" />

        {/* ── SCAR ── */}
        <line x1="138" y1="134" x2="150" y2="145"
          stroke="rgba(0,255,65,0.5)" strokeWidth="1.5" strokeLinecap="square"
          strokeDasharray="2,1.5" />

        {/* ── BOTTOM SEPARATOR ── */}
        <line x1="8" y1="174" x2="192" y2="174" stroke={G} strokeWidth="1" strokeOpacity="0.5" />

        {/* ── BOTTOM STATUS BAR ── */}
        <rect x="8" y="174" width="184" height="18" rx="2"
          fill="rgba(0,255,65,0.05)" />
        <text x="14" y="187" fontFamily="'Courier New', monospace" fontSize="8.5"
          fill={G} filter={`url(#${uid}-glow)`}>
          {hudQuote}
          <tspan fill={cursor ? G : 'transparent'}>█</tspan>
        </text>

        {/* ── SCANLINES ── */}
        <rect x="8" y="8" width="184" height="184" rx="4"
          fill={`url(#${uid}-scan)`} />

        {/* ── VIGNETTE ── */}
        <rect x="8" y="8" width="184" height="184" rx="4"
          fill={`url(#${uid}-vign)`} />

        {/* ── SWEEP LINE ── */}
        <rect x="8" y="-4" width="184" height="2" rx="1" fill={G} fillOpacity="0.22">
          <animateTransform attributeName="transform" type="translate"
            from="0,0" to="0,208" dur={
              mood === 'thinking' ? '1.2s' :
              mood === 'warning'  ? '1.5s' :
              mood === 'focused'  ? '2s'   :
              mood === 'calm'     ? '6s'   : '4s'
            } repeatCount="indefinite" />
        </rect>

      </svg>
    </div>
  )
}
