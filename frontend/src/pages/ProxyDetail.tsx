import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Proxy, CheckResult, Target } from '../types'
import { getCheckHistory, runChecks, resolveExitIP } from '../api/client'
import { useSSE } from '../hooks/useSSE'
import { useTheme } from '../hooks/useTheme'

const PERIODS = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
] as const

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

interface ProxyData {
  proxy: Proxy
  targets: Map<number, Target>
}

export default function ProxyDetail() {
  const { id } = useParams<{ id: string }>()
  const proxyId = Number(id)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [proxyData, setProxyData] = useState<ProxyData | null>(null)
  const [history, setHistory] = useState<CheckResult[]>([])
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(PERIODS[2])
  const [checking, setChecking] = useState(false)
  const [resolvingIP, setResolvingIP] = useState(false)

  const loadHistory = useCallback(async () => {
    const from = new Date(Date.now() - period.hours * 3600000).toISOString()
    const results = await getCheckHistory({ proxy_id: String(proxyId), from, limit: '500' })
    setHistory(results)

    const targets = new Map<number, Target>()
    // extract proxy info from latest checks
    const proxyRes = await fetch(`/api/proxies/${proxyId}`)
    if (proxyRes.ok) {
      const proxy = await proxyRes.json()
      const targetsRes = await fetch('/api/targets')
      if (targetsRes.ok) {
        const allTargets: Target[] = await targetsRes.json()
        allTargets.forEach((t) => targets.set(t.id, t))
      }
      setProxyData({ proxy, targets })
    }
  }, [proxyId, period])

  useEffect(() => { loadHistory() }, [loadHistory])

  useSSE({
    onCheckComplete: () => loadHistory(),
    onExitIPResolved: () => loadHistory(),
  })

  const handleCheck = async () => {
    setChecking(true)
    try { await runChecks(proxyId) } catch {}
    setTimeout(() => setChecking(false), 2000)
  }

  const handleResolveIP = async () => {
    setResolvingIP(true)
    try { await resolveExitIP(proxyId) } catch {}
    setTimeout(() => setResolvingIP(false), 2000)
  }

  if (!proxyData) {
    return <div className="text-gray-500 dark:text-gray-400 py-16 text-center">Loading...</div>
  }

  const { proxy, targets } = proxyData

  // Group history by target for chart
  const targetIds = [...new Set(history.map((h) => h.target_id))]
  const timePoints = [...new Set(history.map((h) => h.checked_at))].sort()

  const chartData = timePoints.map((t) => {
    const point: Record<string, unknown> = { time: t }
    targetIds.forEach((tid) => {
      const check = history.find((h) => h.checked_at === t && h.target_id === tid)
      point[`t${tid}`] = check?.latency_ms ?? null
    })
    return point
  })

  // Uptime per target
  const uptimeByTarget = targetIds.map((tid) => {
    const checks = history.filter((h) => h.target_id === tid)
    const up = checks.filter((c) => c.status === 'up').length
    const pct = checks.length > 0 ? Math.round((up / checks.length) * 100) : null
    const target = targets.get(tid)
    return { tid, name: target?.name || target?.url || `Target #${tid}`, pct, total: checks.length }
  })

  const overallUp = history.filter((c) => c.status === 'up').length
  const overallUptime = history.length > 0 ? Math.round((overallUp / history.length) * 100) : null

  const status = overallUptime === null ? 'unknown' : overallUptime === 100 ? 'up' : overallUptime > 0 ? 'partial' : 'down'

  const formatTime = (val: string) => {
    const d = new Date(val)
    if (period.hours <= 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">
        &larr; Back to Dashboard
      </Link>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              {proxy.name || `Proxy #${proxy.id}`}
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 space-x-4">
              <span>Entry: <span className="font-mono">{proxy.host}:{proxy.port}</span></span>
              <span>Exit IP: <span className="font-mono">{proxy.exit_ip || '—'}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white ${
              status === 'up' ? 'bg-green-500' : status === 'down' ? 'bg-red-500' : 'bg-gray-400'
            }`}>
              {status}
            </span>
            <button onClick={handleCheck} disabled={checking}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm font-medium disabled:opacity-50">
              {checking ? 'Checking...' : 'Check now'}
            </button>
            <button onClick={handleResolveIP} disabled={resolvingIP}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm font-medium disabled:opacity-50">
              {resolvingIP ? 'Resolving...' : 'Resolve IP'}
            </button>
          </div>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PERIODS.map((p) => (
          <button key={p.label} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              period.label === p.label
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Latency chart */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Latency</h3>
        {chartData.length === 0 ? (
          <div className="text-gray-400 dark:text-gray-500 text-sm py-8 text-center">No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                stroke={isDark ? '#4b5563' : '#d1d5db'}
              />
              <YAxis
                tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                stroke={isDark ? '#4b5563' : '#d1d5db'}
                tickFormatter={(v) => `${v}ms`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#1f2937' : '#fff',
                  border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                  borderRadius: '0.375rem',
                  color: isDark ? '#f3f4f6' : '#111827',
                }}
                labelFormatter={(label) => formatTime(String(label))}
                formatter={(value, name) => {
                  const tid = Number(String(name).slice(1))
                  const target = targets.get(tid)
                  return [`${value}ms`, target?.name || target?.url || String(name)]
                }}
              />
              {targetIds.map((tid, i) => (
                <Line
                  key={tid}
                  type="monotone"
                  dataKey={`t${tid}`}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Uptime */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Uptime
          {overallUptime !== null && (
            <span className="ml-2 text-gray-500 dark:text-gray-400 font-normal">({overallUptime}% overall)</span>
          )}
        </h3>
        <div className="space-y-2">
          {uptimeByTarget.map(({ tid, name, pct, total }) => (
            <div key={tid} className="flex items-center gap-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300 flex-1 truncate">{name}</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">{total} checks</span>
              <span className={`font-mono font-medium ${
                pct === null ? 'text-gray-400' : pct === 100 ? 'text-green-500' : pct > 90 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {pct !== null ? `${pct}%` : '—'}
              </span>
            </div>
          ))}
          {uptimeByTarget.length === 0 && (
            <div className="text-gray-400 dark:text-gray-500 text-sm">No check data</div>
          )}
        </div>
      </div>
    </div>
  )
}
