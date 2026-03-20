import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { ThemeContext, useThemeProvider } from './hooks/useTheme'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import ProxyDetail from './pages/ProxyDetail'

function App() {
  const location = useLocation()
  const themeCtx = useThemeProvider()

  const navLink = (to: string, label: string) => {
    const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
    return (
      <Link to={to} className={`px-3 py-1.5 rounded text-sm font-medium ${
        active
          ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}>
        {label}
      </Link>
    )
  }

  return (
    <ThemeContext.Provider value={themeCtx}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">Socks Monitor</h1>
            <div className="flex items-center gap-2 sm:gap-4">
              {navLink('/', 'Dashboard')}
              {navLink('/settings', 'Settings')}
              <button
                onClick={themeCtx.toggle}
                className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                title={themeCtx.theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              >
                {themeCtx.theme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zm8-5a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zm11.95-4.95a.75.75 0 01-1.06 0l-1.06-1.06a.75.75 0 111.06-1.06l1.06 1.06a.75.75 0 010 1.06zm-12.9 9.9a.75.75 0 01-1.06 0l-1.06-1.06a.75.75 0 111.06-1.06l1.06 1.06a.75.75 0 010 1.06zM16.95 15.95a.75.75 0 01-1.06 0l-1.06-1.06a.75.75 0 111.06-1.06l1.06 1.06a.75.75 0 010 1.06zm-12.9-9.9a.75.75 0 01-1.06 0L1.93 4.99a.75.75 0 111.06-1.06l1.06 1.06a.75.75 0 010 1.06zM10 7a3 3 0 100 6 3 3 0 000-6z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/proxy/:id" element={<ProxyDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </ThemeContext.Provider>
  )
}

export default App
