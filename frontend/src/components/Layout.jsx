import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { getAlerts } from '../utils/api'
import { useTheme } from '../hooks/useTheme'

export default function Layout() {
  const [alertCount, setAlertCount] = useState(0)
  const [theme, toggleTheme] = useTheme()
  const location = useLocation()

  useEffect(() => {
    getAlerts()
      .then(r => setAlertCount(r.data.filter(a => !a.is_dismissed).length))
      .catch(() => {})
  }, [location])

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: '📊' },
    { to: '/people',    label: 'People',    icon: '👥' },
    { to: '/loans',     label: 'Loans',     icon: '💰' },
    { to: '/alerts',    label: 'Alerts',    icon: '🔔', badge: alertCount },
    { to: '/backup',    label: 'Backup',    icon: '💾' },
    { to: '/restore',   label: 'Restore',   icon: '⏪' },
    { to: '/help',      label: 'Help & Guides', icon: '💡' }, // <-- NEW HELP LINK
  ]

  return (
    <div className="layout">
      <aside className="sidebar">
      <div className="sidebar-logo">
        {/* Blue Eagle SVG */}
        <div className="sidebar-logo-icon" style={{ background: 'transparent' }}>
          <svg viewBox="0 0 24 24" fill="#2563eb" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 21c0-2.8 2-5 5-5.5 0 0 2-4 6-4 1.5 0 3 1 4 2.5 1-1 3-2 5-2-1 4-3 6-5 6.5C17 21 17 22 17 22H2z" />
          </svg>
        </div>
        <div>
          <div className="sidebar-logo-text">Shadow Debt</div>
          <div className="sidebar-logo-sub">Personal Finance</div>
        </div>
      </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, label, icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span>{icon}</span>
              <span>{label}</span>
              {badge > 0 && <span className="nav-badge">{badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>100% Local · No Cloud</span>
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'} {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
      </aside>

      <div className="main-content">
        <Outlet />
      </div>
    </div>
  )
}
