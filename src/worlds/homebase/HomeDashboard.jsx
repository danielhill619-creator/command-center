import { useEffect, useMemo, useRef, useState } from 'react'
import SystemMonitor from '../../widgets/sysmonitor/SystemMonitor'
import Weather from '../../widgets/weather/Weather'
import NewsReel from '../../widgets/newsreel/NewsReel'

import EmailCenter from '../../widgets/email-center/EmailCenter'
import styles from './HomeDashboard.module.css'

const STORAGE_KEY = 'cc_home_dashboard_layout_v1'
const GRID = 24

function snap(value) {
  return Math.round(value / GRID) * GRID
}

function clampLayoutToWidth(layout, width) {
  return Object.fromEntries(Object.entries(layout).map(([key, item]) => {
    const minW = item.minW || 180
    const safeWidth = Math.max(minW, Math.min(item.w, width))
    const safeX = Math.max(0, Math.min(item.x, Math.max(0, width - safeWidth)))
    return [key, { ...item, w: safeWidth, x: safeX }]
  }))
}

const DEFAULT_LAYOUT = {
  mail:    { x: 0,   y: 0,   w: 960, h: 480, minW: 576, minH: 420, title: 'MAIL CENTER' },
  news:    { x: 0,   y: 504, w: 432, h: 240, minW: 384, minH: 240, title: 'NEWS FEED' },
  weather: { x: 456, y: 504, w: 264, h: 240, minW: 240, minH: 216, title: 'WEATHER' },
  system:  { x: 744, y: 504, w: 216, h: 240, minW: 216, minH: 216, title: 'SYSTEM' },
}

function loadLayout() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return Object.fromEntries(Object.entries(DEFAULT_LAYOUT).map(([key, value]) => [
      key,
      { ...value, ...(raw[key] || {}) },
    ]))
  } catch {
    return DEFAULT_LAYOUT
  }
}

function saveLayout(layout) {
  const stripped = Object.fromEntries(Object.entries(layout).map(([key, value]) => [
    key,
    { x: value.x, y: value.y, w: value.w, h: value.h },
  ]))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped))
}

const CARD_COMPONENTS = {
  mail:    <EmailCenter />,
  news:    <NewsReel />,
  weather: <Weather />,
  system:  <SystemMonitor />,
}

const MOBILE_CARD_ORDER = ['news', 'mail', 'weather', 'system']

export default function HomeDashboard() {
  const [layout, setLayout] = useState(loadLayout)
  const [arrangeMode, setArrangeMode] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1320)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)

  function stopAction() {
    dragRef.current = null
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopAction)
  }

  function handlePointerMove(e) {
    if (!dragRef.current || !canvasRef.current) return
    const { id, type, startX, startY, origin } = dragRef.current
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    const rect = canvasRef.current.getBoundingClientRect()
    const canvasWidth = rect.width

    setLayout(prev => {
      const item = prev[id]
      if (!item) return prev

      if (type === 'drag') {
        const x = Math.max(0, Math.min(snap(origin.x + dx), canvasWidth - item.w))
        const y = Math.max(0, snap(origin.y + dy))
        return { ...prev, [id]: { ...item, x, y } }
      }

      const minW = item.minW || 180
      const minH = item.minH || 180
      const w = Math.max(minW, Math.min(snap(origin.w + dx), canvasWidth - item.x))
      const h = Math.max(minH, snap(origin.h + dy))
      return { ...prev, [id]: { ...item, w, h } }
    })
  }

  useEffect(() => {
    const onResize = () => {
      const nextMobile = window.innerWidth < 1320
      setIsMobile(nextMobile)
      if (!nextMobile) {
        const width = Math.max(720, window.innerWidth - 180)
        setLayout(prev => clampLayoutToWidth(prev, width))
      }
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    saveLayout(layout)
  }, [layout])

  useEffect(() => () => stopAction(), [])

  function startAction(id, type, e) {
    if (!arrangeMode) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...layout[id] },
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopAction)
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT)
  }

  const canvasHeight = useMemo(
    () => Math.max(900, ...Object.values(layout).map(item => item.y + item.h + 12)),
    [layout]
  )

  if (isMobile) {
    const orderedLayout = MOBILE_CARD_ORDER
      .map(id => [id, layout[id]])
      .filter(([, item]) => Boolean(item))

    return (
      <div className={styles.mobileStack}>
        {orderedLayout.map(([id, item]) => (
          <section key={id} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{item.title}</span>
            </div>
            <div className={styles.cardBody}>{CARD_COMPONENTS[id]}</div>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.dashboardShell}>
      <div className={styles.dashboardToolbar}>
        <span className={styles.dashboardLabel}>HOME WIDGET GRID</span>
        <div className={styles.toolbarActions}>
          <button className={styles.toolBtn} onClick={() => setArrangeMode(v => !v)}>
            {arrangeMode ? 'Done' : 'Arrange'}
          </button>
          <button className={styles.toolBtn} onClick={resetLayout}>Reset</button>
        </div>
      </div>

      <div ref={canvasRef} className={styles.canvas} style={{ height: canvasHeight }}>
        {Object.entries(layout).map(([id, item]) => (
          <section
            key={id}
            className={`${styles.card} ${arrangeMode ? styles.cardArrange : ''}`}
            style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
          >
            <div
              className={styles.cardHeader}
              onPointerDown={e => startAction(id, 'drag', e)}
            >
              <span className={styles.cardTitle}>{item.title}</span>
              {arrangeMode && <span className={styles.dragHint}>DRAG</span>}
            </div>
            <div className={styles.cardBody}>{CARD_COMPONENTS[id]}</div>
            {arrangeMode && (
              <button
                type="button"
                className={styles.resizeHandle}
                onPointerDown={e => startAction(id, 'resize', e)}
                aria-label={`Resize ${item.title}`}
              />
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
