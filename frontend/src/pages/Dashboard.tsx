import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import type { ProxyWithChecks, CheckResult } from '../types'
import { getLatestChecks, runChecks, resolveAllExitIPs, getCheckHistory } from '../api/client'
import { useSSE } from '../hooks/useSSE'
import Sparkline from '../components/Sparkline'
import ProxyDetailView from '../components/ProxyDetailView'
import { timeAgo } from '../utils/time'

const PERIODS = [
  { label: '15m', ms: 15 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '6h', ms: 6 * 60 * 60 * 1000 },
  { label: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: '2d', ms: 2 * 24 * 60 * 60 * 1000 },
  { label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
] as const

function statusColor(status: string) {
  if (status === 'up') return 'bg-green-500'
  if (status === 'down' || status === 'error') return 'bg-red-500'
  return 'bg-gray-400'
}

function overallStatus(checks: ProxyWithChecks['checks']): string {
  if (!checks || checks.length === 0) return 'unknown'
  if (checks.every((c) => c.status === 'up')) return 'up'
  if (checks.some((c) => c.status === 'up')) return 'partial'
  return 'down'
}

type Filter = 'all' | 'up' | 'down'

export default function Dashboard() {
  const [data, setData] = useState<ProxyWithChecks[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(PERIODS[1])
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [sparklines, setSparklines] = useState<Record<number, CheckResult[]>>({})
  const [selectedProxyId, setSelectedProxyId] = useState<number | null>(null)

  const location = useLocation()
  useEffect(() => {
    setSelectedProxyId(null)
  }, [location.key])

  const load = useCallback(async () => {
    try {
      const res = await getLatestChecks()
      setData(res)
      return res
    } catch { return [] }
  }, [])

  const loadSparklines = useCallback(async (proxies: ProxyWithChecks[], periodMs: number) => {
    const from = new Date(Date.now() - periodMs).toISOString()
    const result: Record<number, CheckResult[]> = {}
    for (let i = 0; i < proxies.length; i += 5) {
      const batch = proxies.slice(i, i + 5)
      const results = await Promise.all(
        batch.map((p) =>
          getCheckHistory({ proxy_id: String(p.proxy.id), from, limit: periodMs > 2 * 86400000 ? '1000' : '200' }).catch(() => [])
        )
      )
      batch.forEach((p, j) => { result[p.proxy.id] = results[j] })
    }
    setSparklines(result)
  }, [])

  useEffect(() => {
    load().then((res) => {
      if (res.length > 0) loadSparklines(res, period.ms)
    })
  }, [load, loadSparklines, period.ms])

  useSSE({
    onCheckComplete: () => {
      load().then((res) => { if (res.length > 0) loadSparklines(res, period.ms) })
    },
    onExitIPResolved: () => load(),
  })

  const handleRunChecks = async () => {
    setLoading(true)
    try { await runChecks() } catch {}
    setTimeout(() => setLoading(false), 2000)
  }

  const handleResolveIPs = async () => {
    setResolving(true)
    try { await resolveAllExitIPs() } catch {}
    setTimeout(() => setResolving(false), 2000)
  }

  const counts = {
    all: data.length,
    up: data.filter((d) => overallStatus(d.checks) === 'up').length,
    down: data.filter((d) => ['down', 'partial', 'unknown'].includes(overallStatus(d.checks))).length,
  }

  const filtered = data.filter((d) => {
    if (filter === 'all') return true
    const s = overallStatus(d.checks)
    if (filter === 'up') return s === 'up'
    return s !== 'up'
  })

  const pillActive = 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
  const pillInactive = 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
  const btnMuted = 'border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50'

  return (
    <div>
      {/* Filters + period (always visible) */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {(['all', 'up', 'down'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1.5 rounded text-sm font-medium ${filter === f ? pillActive : pillInactive}`}>
                {f === 'all' ? 'All' : f === 'up' ? 'Up' : 'Down'} ({counts[f]})
              </button>
            ))}
          </div>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button key={p.label} onClick={() => setPeriod(p)}
                className={`px-2 py-1.5 rounded text-sm font-medium ${period.label === p.label ? pillActive : pillInactive}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {!selectedProxyId && (
          <div className="flex gap-2 sm:ml-auto">
            <button onClick={handleRunChecks} disabled={loading}
              className={`px-4 py-2 rounded text-sm font-medium ${btnMuted}`}>
              {loading ? 'Checking...' : 'Check all now'}
            </button>
            <button onClick={handleResolveIPs} disabled={resolving}
              className={`px-4 py-2 rounded text-sm font-medium ${btnMuted}`}>
              {resolving ? 'Resolving...' : 'Resolve IPs'}
            </button>
          </div>
        )}
      </div>

      {/* Content: grid or detail */}
      {selectedProxyId ? (
        <ProxyDetailView
          proxyId={selectedProxyId}
          periodMs={period.ms}
          onBack={() => setSelectedProxyId(null)}
        />
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-16">
          No proxies found. Add some in Settings.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <ProxyCard
              key={item.proxy.id}
              data={item}
              history={sparklines[item.proxy.id] || []}
              period={period}
              onClick={() => setSelectedProxyId(item.proxy.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ProxyCardProps {
  data: ProxyWithChecks
  history: CheckResult[]
  period: { label: string; ms: number }
  onClick: () => void
}

function ProxyCard({ data, history, period, onClick }: ProxyCardProps) {
  const { proxy, checks } = data
  const status = overallStatus(checks)
  const lastCheck = checks.length > 0
    ? checks.reduce((a, b) => (new Date(a.checked_at) > new Date(b.checked_at) ? a : b))
    : null

  const uptimePct = history.length > 0
    ? Math.round((history.filter((c) => c.status === 'up').length / history.length) * 100)
    : null

  const sparkPoints = history.map((c) => ({ latency_ms: c.latency_ms, status: c.status }))

  const now = new Date()
  const fromTime = new Date(now.getTime() - period.ms).toISOString()
  const toTime = now.toISOString()

  return (
    <div onClick={onClick} className="cursor-pointer">
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600 p-4 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate mr-2">{proxy.name || `Proxy #${proxy.id}`}</h3>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white shrink-0 ${
            status === 'up' ? 'bg-green-500' : status === 'down' ? 'bg-red-500' : 'bg-gray-400'
          }`}>
            {status}
          </span>
        </div>

        <div className="space-y-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="truncate">
            <span className="text-gray-400 dark:text-gray-500">Entry:</span>{' '}
            <span className="font-mono">{proxy.host}:{proxy.port}</span>
          </div>
          <div className="truncate">
            <span className="text-gray-400 dark:text-gray-500">Exit IP:</span>{' '}
            <span className="font-mono">{proxy.exit_ip || '—'}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
          <div>
            <span className="text-gray-400 dark:text-gray-500">Latency:</span>{' '}
            {lastCheck?.latency_ms != null ? `${lastCheck.latency_ms}ms` : '—'}
          </div>
          <div>
            <span className="text-gray-400 dark:text-gray-500">Uptime ({period.label}):</span>{' '}
            {uptimePct !== null ? (
              <span className={uptimePct === 100 ? 'text-green-500' : uptimePct > 90 ? 'text-yellow-500' : 'text-red-500'}>
                {uptimePct}%
              </span>
            ) : '—'}
          </div>
          <div>
            <span className="text-gray-400 dark:text-gray-500">Last check:</span>{' '}
            {lastCheck ? timeAgo(lastCheck.checked_at) : 'never'}
          </div>
        </div>

        {sparkPoints.length >= 2 && (
          <div className="mb-3">
            <Sparkline points={sparkPoints} fromTime={fromTime} toTime={toTime} periodMs={period.ms} />
          </div>
        )}

        {checks.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1">
            {checks.map((ch) => (
              <div key={ch.target.id} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor(ch.status)}`} />
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{ch.target.name || ch.target.url}</span>
                <span className="text-gray-400 dark:text-gray-500 font-mono shrink-0">
                  {ch.latency_ms != null ? `${ch.latency_ms}ms` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
