import { useEffect, useRef, useState } from 'react'
import styles from './AriaFace.module.css'

const HUD_LINES = {
  idle:     ['Q.U.B.E. ONLINE', 'STANDING BY'],
  thinking: ['PROCESSING', 'RUNNING HEURISTICS'],
  speaking: ['OUTPUT ACTIVE', 'VOICE STREAM LIVE'],
  focused:  ['TARGET LOCKED', 'PRIORITY MODE'],
  warning:  ['ALERT STATE', 'INTERVENTION ADVISED'],
  upbeat:   ['POSITIVE OUTCOME', 'SYSTEM APPROVES'],
  calm:     ['LOW-NOISE MODE', 'AMBIENT STATE'],
}

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

const MOODS = {
  idle:     { primary: '#00d9ff', secondary: '#001e33', accent: '#00ffff', eyeScale: 1.0,  mouthType: 'flat'    },
  thinking: { primary: '#3399ff', secondary: '#00102b', accent: '#66bbff', eyeScale: 0.5,  mouthType: 'flat'    },
  speaking: { primary: '#00ffcc', secondary: '#002b22', accent: '#aaffee', eyeScale: 1.0,  mouthType: 'speak'   },
  focused:  { primary: '#00eaff', secondary: '#001a24', accent: '#88ffff', eyeScale: 0.78, mouthType: 'tight'   },
  warning:  { primary: '#ff8800', secondary: '#1f0a00', accent: '#ffcc00', eyeScale: 1.0,  mouthType: 'warn'    },
  upbeat:   { primary: '#44ffcc', secondary: '#002b1e', accent: '#ccffee', eyeScale: 1.0,  mouthType: 'smile'   },
  calm:     { primary: '#7799bb', secondary: '#0d1a24', accent: '#aabbcc', eyeScale: 0.62, mouthType: 'soft'    },
}

// Voice bar patterns for speaking mouth
const SPEAK_PATTERNS = [
  [3, 9, 14, 10, 4],
  [6, 13,  8, 12, 6],
  [2,  7, 16,  8, 3],
  [8, 11,  7, 14, 5],
  [5, 15, 10, 11, 3],
]

function MouthShape({ type, frame, primary, accent }) {
  if (type === 'speak') {
    const bars = SPEAK_PATTERNS[frame % SPEAK_PATTERNS.length]
    const xs = [84, 91, 98, 105, 112]
    return (
      <g>
        {bars.map((h, i) => (
          <rect
            key={i}
            x={xs[i] - 2}
            y={152 - h}
            width={4}
            height={h}
            fill={primary}
            opacity="0.95"
            rx="1.5"
          />
        ))}
        <line x1="79" y1="153" x2="121" y2="153" stroke={accent} strokeWidth="0.6" opacity="0.35" />
      </g>
    )
  }
  const paths = {
    flat:  'M 82 150 L 118 150',
    tight: 'M 86 150 L 114 150',
    warn:  'M 80 153 L 100 146 L 120 153',
    smile: 'M 80 148 Q 100 160 120 148',
    soft:  'M 83 150 Q 100 155 117 150',
  }
  return (
    <path
      d={paths[type] || paths.flat}
      fill="none"
      stroke={primary}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  )
}

export default function AriaFace({ mood = 'idle', size = 'md', label = 'Q.U.B.E.' }) {
  const config = MOODS[mood] ?? MOODS.idle
  const uid = useRef(`qube-${Math.random().toString(36).slice(2, 8)}`).current
  const [blink, setBlink] = useState(false)
  const [frame, setFrame] = useState(0)
  const [hudIndex, setHudIndex] = useState(0)

  // Blink timer
  useEffect(() => {
    let active = true
    function cycle() {
      const id = setTimeout(() => {
        if (!active) return
        setBlink(true)
        setTimeout(() => setBlink(false), 85)
        cycle()
      }, 2600 + Math.random() * 2800)
      return id
    }
    const id = cycle()
    return () => { active = false; clearTimeout(id) }
  }, [])

  // Mouth animation frame
  useEffect(() => {
    const id = setInterval(() => setFrame(f => f + 1), mood === 'speaking' ? 175 : 900)
    return () => clearInterval(id)
  }, [mood])

  // HUD cycling
  useEffect(() => {
    const id = setInterval(() => setHudIndex(i => i + 1), 2600)
    return () => clearInterval(id)
  }, [])

  const hudLine = HUD_LINES[mood]?.[hudIndex % HUD_LINES[mood].length] ?? 'ONLINE'
  const eyeScale = blink ? 0.05 : config.eyeScale
  const { primary, secondary, accent } = config

  // Face polygon: 8-point angular skull shape
  const facePath = 'M 100 16 L 156 48 L 174 100 L 154 152 L 100 170 L 46 152 L 26 100 L 44 48 Z'

  return (
    <div className={`${styles.container} ${styles[size]} ${styles[mood]}`}>
      <svg viewBox="0 0 200 200" className={styles.svg} xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Face fill gradient */}
          <linearGradient id={`${uid}-face`} x1="0.3" x2="0.7" y1="0" y2="1">
            <stop offset="0%"   stopColor={secondary} stopOpacity="0.95" />
            <stop offset="60%"  stopColor={secondary} stopOpacity="0.75" />
            <stop offset="100%" stopColor="#000000"   stopOpacity="0.85" />
          </linearGradient>

          {/* Eye inner glow */}
          <radialGradient id={`${uid}-eyeGlow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#ffffff"  stopOpacity="1"   />
            <stop offset="25%"  stopColor={primary}  stopOpacity="0.9" />
            <stop offset="70%"  stopColor={accent}   stopOpacity="0.4" />
            <stop offset="100%" stopColor={accent}   stopOpacity="0"   />
          </radialGradient>

          {/* Ambient outer glow */}
          <radialGradient id={`${uid}-ambient`} cx="50%" cy="45%" r="50%">
            <stop offset="0%"   stopColor={primary} stopOpacity="0.18" />
            <stop offset="100%" stopColor={primary} stopOpacity="0"    />
          </radialGradient>

          {/* Projection beam gradient */}
          <linearGradient id={`${uid}-beam`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor={primary} stopOpacity="0.25" />
            <stop offset="100%" stopColor={primary} stopOpacity="0"    />
          </linearGradient>

          {/* Soft glow filter */}
          <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Strong glow for pupils */}
          <filter id={`${uid}-pulse`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Clip to face shape */}
          <clipPath id={`${uid}-faceClip`}>
            <path d={facePath} />
          </clipPath>
        </defs>

        {/* ===================== LAYER 0: AMBIENT + PROJECTION ===================== */}

        {/* Outer ambient glow sphere */}
        <ellipse cx="100" cy="95" rx="94" ry="94" fill={`url(#${uid}-ambient)`} />

        {/* Hologram projection beam from bottom */}
        <path
          d={`M 100 170 L 58 200 L 142 200 Z`}
          fill={`url(#${uid}-beam)`}
          opacity="0.5"
        />
        {/* Emitter disc at base */}
        <ellipse cx="100" cy="186" rx="48" ry="6"  fill={primary} opacity="0.15" />
        <ellipse cx="100" cy="186" rx="28" ry="3.5" fill={primary} opacity="0.28" />
        <ellipse cx="100" cy="186" rx="12" ry="1.5" fill={primary} opacity="0.55" />

        {/* ===================== LAYER 1: ORBITAL RINGS — BACK ARCS ===================== */}

        {/* Ring 1 — horizontal orbit, back arc (behind head, top portion, dimmer) */}
        <path
          d="M 14 100 A 86 12 0 0 0 186 100"
          fill="none"
          stroke={primary}
          strokeWidth="1.4"
          strokeOpacity="0.22"
          strokeDasharray="14 9"
          className={styles.ring1}
        />

        {/* Ring 2 — tilted orbit, back arc */}
        <path
          d="M 24 100 A 76 10 0 0 0 176 100"
          fill="none"
          stroke={accent}
          strokeWidth="1"
          strokeOpacity="0.2"
          strokeDasharray="6 14"
          transform="rotate(-48 100 100)"
          className={styles.ring2}
        />

        {/* ===================== LAYER 2: FACE SHELL ===================== */}

        {/* Main face polygon */}
        <path
          d={facePath}
          fill={`url(#${uid}-face)`}
          stroke={primary}
          strokeWidth="1.6"
          strokeOpacity="0.75"
        />

        {/* Edge highlight facets — brighter top edges for 3D depth */}
        <path d="M 100 16 L 156 48" stroke={primary} strokeWidth="1.2" strokeOpacity="0.9" />
        <path d="M 100 16 L 44 48"  stroke={primary} strokeWidth="1.2" strokeOpacity="0.9" />
        <path d="M 156 48 L 174 100" stroke={primary} strokeWidth="0.7" strokeOpacity="0.4" />
        <path d="M 44 48 L 26 100"  stroke={primary} strokeWidth="0.7" strokeOpacity="0.4" />
        <path d="M 174 100 L 154 152" stroke={primary} strokeWidth="0.5" strokeOpacity="0.22" />
        <path d="M 26 100 L 46 152"  stroke={primary} strokeWidth="0.5" strokeOpacity="0.22" />

        {/* ===================== LAYER 3: INTERNAL 3D GRID ===================== */}

        {/* Horizontal contour lines (perspective face surface) */}
        <line x1="56"  y1="68"  x2="144" y2="68"  stroke={primary} strokeWidth="0.45" strokeOpacity="0.14" />
        <line x1="40"  y1="100" x2="160" y2="100" stroke={primary} strokeWidth="0.45" strokeOpacity="0.1"  />
        <line x1="50"  y1="134" x2="150" y2="134" stroke={primary} strokeWidth="0.4"  strokeOpacity="0.1"  />

        {/* Vertical center spine */}
        <line x1="100" y1="20"  x2="100" y2="166" stroke={primary} strokeWidth="0.45" strokeOpacity="0.1" />

        {/* Diagonal facial topology lines */}
        <path d="M 60 50 L 66 70 L 58 100" fill="none" stroke={primary} strokeWidth="0.4" strokeOpacity="0.14" />
        <path d="M 140 50 L 134 70 L 142 100" fill="none" stroke={primary} strokeWidth="0.4" strokeOpacity="0.14" />

        {/* ===================== LAYER 4: SCAN SWEEP (CSS animated) ===================== */}
        <rect
          x="28" y="0" width="144" height="3"
          fill={primary}
          opacity="0.5"
          className={styles.scanSweep}
          clipPath={`url(#${uid}-faceClip)`}
        />

        {/* ===================== LAYER 5: BROW SENSOR BARS ===================== */}

        {/* Left brow — angular sensor line */}
        <path
          d="M 46 76 L 68 70 L 92 75"
          fill="none"
          stroke={primary}
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.8"
          filter={`url(#${uid}-glow)`}
        />
        {/* Right brow */}
        <path
          d="M 154 76 L 132 70 L 108 75"
          fill="none"
          stroke={primary}
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.8"
          filter={`url(#${uid}-glow)`}
        />
        {/* Brow apex dots */}
        <circle cx="68"  cy="70" r="2.2" fill={primary} opacity="0.85" filter={`url(#${uid}-glow)`} />
        <circle cx="132" cy="70" r="2.2" fill={primary} opacity="0.85" filter={`url(#${uid}-glow)`} />

        {/* ===================== LAYER 6: EYES ===================== */}

        {/* LEFT EYE */}
        <g transform={`translate(72 94) scale(1 ${eyeScale}) translate(-72 -94)`}>
          {/* Socket ambient glow */}
          <ellipse cx="72" cy="94" rx="21" ry="11" fill={`url(#${uid}-eyeGlow)`} opacity="0.38" />
          {/* Diamond eye shape */}
          <path
            d="M 52 94 L 72 82 L 92 94 L 72 106 Z"
            fill={secondary}
            stroke={primary}
            strokeWidth="1.8"
            filter={`url(#${uid}-glow)`}
          />
          {/* Iris ring */}
          <circle cx="72" cy="94" r="9"   fill={primary}   opacity="0.22" />
          <circle cx="72" cy="94" r="9"   fill="none"      stroke={primary} strokeWidth="1.2" opacity="0.7" />
          {/* Inner scan ring (dashed) */}
          <circle cx="72" cy="94" r="12"  fill="none"      stroke={primary} strokeWidth="0.6" strokeOpacity="0.35" strokeDasharray="2.5 3" />
          {/* Pupil */}
          <circle cx="72" cy="94" r="4"   fill={primary}   opacity="0.8"  />
          <circle cx="72" cy="94" r="2.5" fill="#ffffff"   opacity="0.98" filter={`url(#${uid}-pulse)`} />
        </g>

        {/* RIGHT EYE */}
        <g transform={`translate(128 94) scale(1 ${eyeScale}) translate(-128 -94)`}>
          <ellipse cx="128" cy="94" rx="21" ry="11" fill={`url(#${uid}-eyeGlow)`} opacity="0.38" />
          <path
            d="M 108 94 L 128 82 L 148 94 L 128 106 Z"
            fill={secondary}
            stroke={primary}
            strokeWidth="1.8"
            filter={`url(#${uid}-glow)`}
          />
          <circle cx="128" cy="94" r="9"   fill={primary}   opacity="0.22" />
          <circle cx="128" cy="94" r="9"   fill="none"      stroke={primary} strokeWidth="1.2" opacity="0.7" />
          <circle cx="128" cy="94" r="12"  fill="none"      stroke={primary} strokeWidth="0.6" strokeOpacity="0.35" strokeDasharray="2.5 3" />
          <circle cx="128" cy="94" r="4"   fill={primary}   opacity="0.8"  />
          <circle cx="128" cy="94" r="2.5" fill="#ffffff"   opacity="0.98" filter={`url(#${uid}-pulse)`} />
        </g>

        {/* ===================== LAYER 7: NOSE + MOUTH ===================== */}

        {/* Nose bridge — angular geometric structure */}
        <path
          d="M 97 109 L 93 124 L 107 124 L 103 109"
          fill="none"
          stroke={primary}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.45"
        />
        <line x1="93" y1="124" x2="107" y2="124" stroke={accent} strokeWidth="1" strokeOpacity="0.3" />

        {/* Mouth */}
        <MouthShape type={config.mouthType} frame={frame} primary={primary} accent={accent} />

        {/* Chin detail line */}
        <path d="M 88 160 L 100 166 L 112 160" fill="none" stroke={primary} strokeWidth="1" strokeOpacity="0.3" />

        {/* ===================== LAYER 8: HUD OVERLAYS ===================== */}

        {/* Top label */}
        <text x="100" y="11" textAnchor="middle" className={styles.svgLabel} fill={primary}>{label}</text>

        {/* Bottom status */}
        <text x="100" y="181" textAnchor="middle" className={styles.svgHud} fill={accent}>{hudLine}</text>

        {/* Side HUD brackets */}
        <path d="M 18 76 L 12 76 L 12 124 L 18 124" fill="none" stroke={accent} strokeWidth="1.2" strokeOpacity="0.45" />
        <path d="M 182 76 L 188 76 L 188 124 L 182 124" fill="none" stroke={accent} strokeWidth="1.2" strokeOpacity="0.45" />

        {/* Corner targeting reticles */}
        <path d="M 6 8  L 6 20  M 6 8  L 18 8"  stroke={accent} strokeWidth="1.1" strokeOpacity="0.5" fill="none" />
        <path d="M 194 8  L 194 20  M 194 8  L 182 8"  stroke={accent} strokeWidth="1.1" strokeOpacity="0.5" fill="none" />
        <path d="M 6 192 L 6 180  M 6 192 L 18 192" stroke={accent} strokeWidth="1.1" strokeOpacity="0.5" fill="none" />
        <path d="M 194 192 L 194 180 M 194 192 L 182 192" stroke={accent} strokeWidth="1.1" strokeOpacity="0.5" fill="none" />

        {/* Side micro readouts */}
        <text x="15"  y="98"  className={styles.svgMicro} fill={accent} opacity="0.5">SYS</text>
        <text x="15"  y="106" className={styles.svgMicro} fill={accent} opacity="0.5">OK</text>
        <text x="185" y="98"  className={styles.svgMicro} fill={accent} opacity="0.5" textAnchor="end">NET</text>
        <text x="185" y="106" className={styles.svgMicro} fill={accent} opacity="0.5" textAnchor="end">ACT</text>

        {/* Floating data nodes */}
        <circle cx="22"  cy="54"  r="1.5" fill={primary} opacity="0.45" />
        <circle cx="178" cy="54"  r="1.5" fill={primary} opacity="0.45" />
        <circle cx="14"  cy="140" r="1.5" fill={accent}  opacity="0.38" />
        <circle cx="186" cy="140" r="1.5" fill={accent}  opacity="0.38" />
        <circle cx="100" cy="8"   r="1.8" fill={primary} opacity="0.55" />

        {/* ===================== LAYER 9: ORBITAL RINGS — FRONT ARCS ===================== */}

        {/* Ring 1 — front arc (in front of face, bottom portion, brighter) */}
        <path
          d="M 14 100 A 86 12 0 0 1 186 100"
          fill="none"
          stroke={primary}
          strokeWidth="2"
          strokeOpacity="0.7"
          strokeDasharray="14 9"
          className={styles.ring1}
        />

        {/* Ring 2 — tilted orbit, front arc */}
        <path
          d="M 24 100 A 76 10 0 0 1 176 100"
          fill="none"
          stroke={accent}
          strokeWidth="1.2"
          strokeOpacity="0.45"
          strokeDasharray="6 14"
          transform="rotate(-48 100 100)"
          className={styles.ring2}
        />
      </svg>
    </div>
  )
}
