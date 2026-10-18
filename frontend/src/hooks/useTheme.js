import { useState, useEffect } from 'react'
import api from '../utils/api'

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)

    // Crucial fix: Don't ask the DB for the theme if we aren't logged in yet!
    if (!localStorage.getItem('token')) return;

    api.get('/settings/')
    .then(r => {
      if (r.data.theme) {
        setTheme(r.data.theme)
        document.documentElement.setAttribute('data-theme', r.data.theme)
        localStorage.setItem('theme', r.data.theme)
      }
    })
    .catch(() => console.log("DB unreachable, using local theme"))
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)

    if (!localStorage.getItem('token')) return;

    try {
      await api.patch('/settings/theme', { value: newTheme })
    } catch {
      console.log("Could not save theme to DB, relying on local storage")
    }
  }

  return [theme, toggle]
}
