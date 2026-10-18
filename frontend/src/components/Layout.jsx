import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import api, { getAlerts } from '../utils/api'
import { useTheme } from '../hooks/useTheme'

export default function Layout() {
  const [alertCount, setAlertCount] = useState(0)
  const [user, setUser] = useState(null)
  const [theme, toggleTheme] = useTheme()
  const location = useLocation()

  useEffect(() => {
    // Only try to fetch if we have a token
    if (localStorage.getItem('token')) {
      getAlerts().then(r => setAlertCount(r.data.filter(a => !a.is_dismissed).length)).catch(() => {})
      api.get('/auth/me').then(r => setUser(r.data)).catch(() => {})
    }
  }, [location])

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: '📊' },
    { to: '/people',    label: 'People',    icon: '👥' },
    { to: '/loans',     label: 'Loans',     icon: '💰' },
    { to: '/alerts',    label: 'Alerts',    icon: '🔔', badge: alertCount },
    { to: '/backup',    label: 'Backup',    icon: '💾' },
    { to: '/restore',   label: 'Restore',   icon: '⏪' },
    { to: '/help',      label: 'Help & Guides', icon: '💡' },
  ]

  return (
    <div className="layout">
    <aside className="sidebar">
    <div className="sidebar-logo">
    <div className="sidebar-logo-icon" style={{ background: 'transparent' }}>
    <svg viewBox="0 0 24 24" fill="#2563eb" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 2C22 2 14.5 4 12 8C9.5 4 2 2 2 2C2 2 6.5 8 5 14C8 12 12 16 12 16C12 16 16 12 19 14C17.5 8 22 2 22 2Z" />
    </svg>
    </div>
    <div>
    <div className="sidebar-logo-text">Shadow Debt</div>
    <div className="sidebar-logo-sub">Personal Finance</div>
    </div>
    </div>
    <nav className="sidebar-nav">
    {navItems.map(({ to, label, icon, badge }) => (
      <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      <span>{icon}</span>
      <span>{label}</span>
      {badge > 0 && <span className="nav-badge">{badge}</span>}
      </NavLink>
    ))}
    </nav>

    {/* 👇 THE NEW AVATAR FOOTER 👇 */}
    <div className="sidebar-footer" style={{ flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
    <NavLink to="/profile" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#e2e8f0', fontWeight: 600, textDecoration: 'none', width: '100%', padding: '6px 0' }}>
    {user?.profile_picture ? (
      <img src={`/uploads/${user.profile_picture}`} alt="Avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
    ) : (
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
      {user?.username?.charAt(0).toUpperCase() || 'A'}
      </div>
    )}
    <div style={{ display: 'flex', flexDirection: 'column' }}>
    <span style={{ fontSize: 14 }}>{user?.username || 'Admin'}</span>
    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>⚙ Settings & Profile</span>
    </div>
    </NavLink>

    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginTop: 8 }}>
    <button className="theme-toggle" onClick={toggleTheme}>
    {theme === 'light' ? '🌙' : '☀'} {theme === 'light' ? 'Dark' : 'Light'}
    </button>
    <button className="theme-toggle" onClick={() => { localStorage.removeItem('token'); window.location.href='/login'; }}>
    🚪 Logout
    </button>
    </div>
    </div>
    </aside>
    <div className="main-content"><Outlet /></div>
    </div>
  )
}
