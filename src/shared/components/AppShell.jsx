import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../../firebase'
import { useAuth } from '../hooks/useAuth'
import styles from './AppShell.module.css'

const BUILD_LABEL = 'build CeKuid5u'

const PRIMARY_LINKS = [
  { to: '/homebase', label: 'Home Base', icon: '⌂', color: '#7ce4ff' },
  { to: '/mail', label: 'Mail', icon: '✉', color: '#8cffb7' },
  { to: '/work', label: 'Work', icon: '◈', color: '#5cc8ff' },
  { to: '/school', label: 'School', icon: '◉', color: '#ff4fa3' },
  { to: '/home', label: 'Home', icon: '⬡', color: '#7fe27a' },
  { to: '/fun', label: 'Fun', icon: '★', color: '#ffd45f' },
  { to: '/spiritual', label: 'Spiritual', icon: '✦', color: '#d9b96d' },
]

const SECONDARY_LINKS = [
  { to: '/settings', label: 'Settings', icon: '⚙', color: '#b2d6ff' },
  { to: '/login', label: 'Login', icon: '→', color: '#d9e6f5' },
]

function NavItem({ item, expanded, onNavigate }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
      onClick={onNavigate}
      style={{ '--nav-color': item.color }}
    >
      <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
      <span className={`${styles.navLabel} ${expanded ? styles.navLabelVisible : ''}`}>{item.label}</span>
    </NavLink>
  )
}

export default function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  async function handleSignOut() {
    await signOut(auth)
    navigate('/login', { replace: true })
    setMobileOpen(false)
  }

  const sidebarOpen = expanded || mobileOpen

  return (
    <div className={styles.shell}>
      <button
        type="button"
        className={styles.mobileToggle}
        onClick={() => setMobileOpen(open => !open)}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
      >
        <span />
        <span />
        <span />
      </button>

      {mobileOpen && <button type="button" className={styles.backdrop} onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}

      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className={styles.sidebarTop}>
          <button
            type="button"
            className={styles.brand}
            onClick={() => navigate(user ? '/homebase' : '/login')}
          >
            <span className={styles.brandMark}>⬡</span>
            <span className={`${styles.brandText} ${sidebarOpen ? styles.brandTextVisible : ''}`}>Command Center</span>
          </button>

          <div className={`${styles.account} ${sidebarOpen ? styles.accountVisible : ''}`}>
            <div className={styles.accountLabel}>{user ? 'Signed in' : 'Guest mode'}</div>
            <div className={styles.accountValue}>{user?.email || 'Use Login to enter'}</div>
          </div>
        </div>

        <nav className={styles.navGroup}>
          <div className={`${styles.groupLabel} ${sidebarOpen ? styles.groupLabelVisible : ''}`}>Worlds</div>
          {PRIMARY_LINKS.map(item => (
            <NavItem key={item.to} item={item} expanded={sidebarOpen} onNavigate={() => setMobileOpen(false)} />
          ))}
        </nav>

        <nav className={styles.navGroup}>
          <div className={`${styles.groupLabel} ${sidebarOpen ? styles.groupLabelVisible : ''}`}>Control</div>
          {SECONDARY_LINKS.map(item => (
            <NavItem key={item.to} item={item} expanded={sidebarOpen} onNavigate={() => setMobileOpen(false)} />
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={`${styles.buildStamp} ${sidebarOpen ? styles.buildStampVisible : ''}`}>{BUILD_LABEL}</div>
          {user && (
            <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
              <span className={styles.navIcon} aria-hidden="true">⎋</span>
              <span className={`${styles.navLabel} ${sidebarOpen ? styles.navLabelVisible : ''}`}>Sign Out</span>
            </button>
          )}
        </div>
      </aside>

      <div className={styles.content}>
        <div className={styles.liveBadge}>{BUILD_LABEL}</div>
        <Outlet />
      </div>
    </div>
  )
}
