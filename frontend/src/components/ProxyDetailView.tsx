import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Proxy, CheckResult, Target } from '../types'
import { getCheckHistory, runChecks, resolveExitIP } from '../api/client'
import { useSSE } from '../hooks/useSSE'
import { useTheme } from '../hooks/useTheme'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

interface Props {
  proxyId: number
  periodMs: number
  onBack: () => void
}

export default function ProxyDetailView({ proxyId, periodMs, onBack }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [proxy, setProxy] = useState<Proxy | null>(null)
  const [history, setHistory] = useState<CheckResult[]>([])
  const [targets, setTargets] = useState<Map<number, Target>>(new Map())
  const [checking, setChecking] = useState(false)
  const [resolvingIP, setResolvingIP] = useState(false)

  const loadData = useCallback(async () => {
    const from = new Date(Date.now() - periodMs).toISOString()
    const [results, proxyRes, targetsRes] = await Promise.all([
      getCheckHistory({ proxy_id: String(proxyId), from, limit: '500' }).catch(() => []),
      fetch(`/api/proxies/${proxyId}`).catch(() => null),
      fetch('/api/targets').catch(() => null),
    ])
    setHistory(results)
    if (proxyRes?.ok) setProxy(await proxyRes.json())
    if (targetsRes?.ok) {
      const all: Target[] = await targetsRes.json()
      const m = new Map<number, Target>()
      all.forEach((t) => m.set(t.id, t))
      setTargets(m)
    }
  }, [proxyId, periodMs])

  useEffect(() => { loadData() }, [loadData])

  useSSE({
    onCheckComplete: () => loadData(),
    onExitIPResolved: () => loadData(),
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

  if (!proxy) return <div className="text-gray-500 dark:text-gray-400 py-16 text-center">Loading...</div>

  // Metrics
  const upChecks = history.filter((c) => c.status === 'up')
  const uptimePct = history.length > 0 ? Math.round((upChecks.length / history.length) * 100) : null
  const latencies = upChecks.filter((c) => c.latency_ms != null).map((c) => c.latency_ms!)
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : null
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : null

  // Chart
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
    return { tid, name: target?.name || target?.url || `Target #${tid}`, pct, up, total: checks.length }
  })

  // Recent checks (last 20)
  const recentChecks = [...history].sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()).slice(0, 20)

  const periodHours = periodMs / 3600000
  const formatTime = (val: string) => {
    const d = new Date(val)
    if (periodHours <= 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const overallUp = history.filter((c) => c.status === 'up').length
  const overallStatus = history.length === 0 ? 'unknown' : overallUp === history.length ? 'up' : overallUp > 0 ? 'partial' : 'down'

  const btnMuted = 'border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50'

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4">
        &larr; Back to list
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                {proxy.name || `Proxy #${proxy.id}`}
              </h2>
              <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white ${
                overallStatus === 'up' ? 'bg-green-500' : overallStatus === 'down' ? 'bg-red-500' : 'bg-gray-400'
              }`}>
                {overallStatus}
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-x-4">
              <span>Entry: <span className="font-mono">{proxy.host}:{proxy.port}</span></span>
              <span>Exit IP: <span className="font-mono">{proxy.exit_ip || '—'}</span></span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCheck} disabled={checking}
              className={`px-3 py-1.5 rounded text-sm font-medium ${btnMuted}`}>
              {checking ? 'Checking...' : 'Check now'}
            </button>
            <button onClick={handleResolveIP} disabled={resolvingIP}
              className={`px-3 py-1.5 rounded text-sm font-medium ${btnMuted}`}>
              {resolvingIP ? 'Resolving...' : 'Resolve IP'}
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <MetricCard label="Uptime" value={uptimePct !== null ? `${uptimePct}%` : '—'}
          color={uptimePct === null ? '' : uptimePct === 100 ? 'text-green-400' : uptimePct > 90 ? 'text-yellow-400' : 'text-red-400'} />
        <MetricCard label="Avg latency" value={avgLatency !== null ? `${avgLatency}ms` : '—'} />
        <MetricCard label="Min latency" value={minLatency !== null ? `${minLatency}ms` : '—'} />
        <MetricCard label="Max latency" value={maxLatency !== null ? `${maxLatency}ms` : '—'} />
        <MetricCard label="Checks" value={history.length > 0 ? `${upChecks.length} / ${history.length}` : '—'} />
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Latency</h3>
        {chartData.length === 0 ? (
          <div className="text-gray-400 dark:text-gray-500 text-sm py-8 text-center">No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
              <XAxis dataKey="time" tickFormatter={formatTime}
                tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                stroke={isDark ? '#4b5563' : '#d1d5db'} />
              <YAxis tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                stroke={isDark ? '#4b5563' : '#d1d5db'} tickFormatter={(v) => `${v}ms`} width={55} />
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
                <Line key={tid} type="monotone" dataKey={`t${tid}`}
                  stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Uptime per target */}
      {uptimeByTarget.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Uptime by target</h3>
          <div className="space-y-3">
            {uptimeByTarget.map(({ tid, name, pct, up, total }) => (
              <div key={tid}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300 truncate mr-3">{name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">{up}/{total} checks</span>
                    <span className={`font-mono font-medium w-10 text-right ${
                      pct === null ? 'text-gray-400' : pct === 100 ? 'text-green-500' : pct > 90 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {pct !== null ? `${pct}%` : '—'}
                    </span>
                  </div>
                </div>
                {pct !== null && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${
                      pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent checks */}
      {recentChecks.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Recent checks</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                <tr>
                  <th className="text-left pr-4 py-1">Time</th>
                  <th className="text-left pr-4 py-1">Target</th>
                  <th className="text-left pr-4 py-1">Status</th>
                  <th className="text-right pr-4 py-1">Latency</th>
                  <th className="text-left py-1">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentChecks.map((c) => {
                  const target = targets.get(c.target_id)
                  return (
                    <tr key={c.id}>
                      <td className="pr-4 py-1.5 text-gray-500 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                        {new Date(c.checked_at).toLocaleTimeString()}
                      </td>
                      <td className="pr-4 py-1.5 text-gray-700 dark:text-gray-300 truncate max-w-[12rem]">
                        {target?.name || target?.url || `#${c.target_id}`}
                      </td>
                      <td className="pr-4 py-1.5 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${c.status === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className={c.status === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {c.status}
                          </span>
                        </span>
                      </td>
                      <td className="pr-4 py-1.5 text-right font-mono text-gray-500 dark:text-gray-400">
                        {c.latency_ms != null ? `${c.latency_ms}ms` : '—'}
                      </td>
                      <td className="py-1.5 text-red-500 dark:text-red-400 text-xs truncate max-w-[10rem]">
                        {c.error_msg || ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color || 'text-gray-900 dark:text-gray-100'}`}>{value}</div>
    </div>
  )
}
