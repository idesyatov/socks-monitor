import { createContext, useContext, useState, useCallback } from 'react'

type Theme = 'dark' | 'light'

interface ThemeCtx {
  theme: Theme
  toggle: () => void
}

export const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {} })

export function useThemeProvider() {
  const [theme, setTheme] = useState<Theme>(() => {
    return localStorage.theme === 'light' ? 'light' : 'dark'
  })

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.theme = next
      if (next === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      return next
    })
  }, [])

  return { theme, toggle }
}

export function useTheme() {
  return useContext(ThemeContext)
}
