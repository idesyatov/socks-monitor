interface Point {
  latency_ms: number | null
  status: string
}

interface Props {
  points: Point[]
  fromTime?: string
  toTime?: string
  periodMs?: number
}

function getTickConfig(periodMs: number): { count: number; formatFn: (d: Date) => string } {
  const hour = 3600_000
  const day = 86400_000

  if (periodMs <= 15 * 60_000) {
    return { count: 2, formatFn: (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  }
  if (periodMs <= hour) {
    return { count: 5, formatFn: (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  }
  if (periodMs <= 6 * hour) {
    return { count: 7, formatFn: (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  }
  if (periodMs <= day) {
    return { count: 7, formatFn: (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  }
  if (periodMs <= 2 * day) {
    return { count: 5, formatFn: (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  }
  return { count: 8, formatFn: (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' }) }
}

export default function Sparkline({ points, fromTime, toTime, periodMs }: Props) {
  if (points.length < 2) return null

  const w = 200
  const h = 36
  const pad = 2
  const usableH = h - pad * 2
  const usableW = w - pad * 2

  const latencies = points.filter((p) => p.latency_ms != null).map((p) => p.latency_ms!)
  const hasLatency = latencies.length > 0
  const minLatency = hasLatency ? Math.min(...latencies) : 0
  const maxLatency = hasLatency ? Math.max(...latencies) : 1
  const latencyRange = maxLatency || 1

  const mappedPoints = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * usableW
    const isDown = p.status === 'down' || p.status === 'error' || p.latency_ms == null
    const normalized = isDown ? 0 : Math.max(0.1, p.latency_ms! / latencyRange)
    const y = pad + usableH - normalized * usableH
    return { x, y, isDown }
  })

  const linePoints = mappedPoints.map((p) => `${p.x},${p.y}`).join(' ')
  const areaPath =
    `M${mappedPoints[0].x},${h} ` +
    mappedPoints.map((p) => `L${p.x},${p.y}`).join(' ') +
    ` L${mappedPoints[mappedPoints.length - 1].x},${h} Z`

  const hasDown = points.some((p) => p.status === 'down' || p.status === 'error')

  const downZones: { x1: number; x2: number }[] = []
  mappedPoints.forEach((p, i) => {
    if (p.isDown) {
      const halfStep = i > 0 ? (mappedPoints[i].x - mappedPoints[i - 1].x) / 2 : 0
      const nextHalf = i < mappedPoints.length - 1 ? (mappedPoints[i + 1].x - p.x) / 2 : 0
      const x1 = p.x - halfStep
      const x2 = p.x + nextHalf
      downZones.push({ x1: Math.max(pad, x1), x2: Math.min(w - pad, x2) })
    }
  })

  // Min/max Y positions for dashed lines
  const maxY = pad + usableH - Math.max(0.1, maxLatency / latencyRange) * usableH
  const minY = hasLatency && minLatency !== maxLatency
    ? pad + usableH - Math.max(0.1, minLatency / latencyRange) * usableH
    : null

  // Compute ticks
  const hasTicks = fromTime && toTime && periodMs
  const ticks: { x: number; label: string }[] = []
  if (hasTicks) {
    const fromMs = new Date(fromTime).getTime()
    const toMs = new Date(toTime).getTime()
    const range = toMs - fromMs
    const cfg = getTickConfig(periodMs)
    for (let i = 0; i < cfg.count; i++) {
      const t = fromMs + (i / (cfg.count - 1)) * range
      const x = pad + (i / (cfg.count - 1)) * usableW
      ticks.push({ x, label: cfg.formatFn(new Date(t)) })
    }
  }

  const sparkSvg = (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: `${h}px` }} preserveAspectRatio="none">
      <path d={areaPath} fill="#22c55e" opacity={0.15} />
      {downZones.map((z, i) => (
        <rect key={i} x={z.x1} y={pad} width={z.x2 - z.x1} height={usableH} fill="#ef4444" opacity={0.2} />
      ))}
      {hasLatency && (
        <line x1={pad} y1={maxY} x2={w - pad} y2={maxY} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" opacity={0.1} />
      )}
      {minY !== null && (
        <line x1={pad} y1={minY} x2={w - pad} y2={minY} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" opacity={0.1} />
      )}
      {ticks.map((tick, i) => (
        <line key={i} x1={tick.x} y1={pad} x2={tick.x} y2={h - pad} stroke="currentColor" strokeWidth="0.5" opacity={0.15} />
      ))}
      <polyline
        points={linePoints}
        fill="none"
        stroke={hasDown ? '#ef4444' : '#22c55e'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )

  return (
    <div>
      {hasLatency ? (
        <div className="flex items-stretch gap-1">
          <div className="flex flex-col justify-between text-[10px] font-mono text-gray-500 dark:text-gray-500 leading-none py-0.5">
            <span>{maxLatency}ms</span>
            <span>{minLatency}ms</span>
          </div>
          <div className="flex-1 min-w-0">{sparkSvg}</div>
        </div>
      ) : (
        sparkSvg
      )}
      {ticks.length > 0 && (
        <div className="flex text-gray-500 dark:text-gray-600" style={{ fontSize: '10px', paddingLeft: hasLatency ? '3rem' : 0 }}>
          {ticks.map((tick, i) => (
            <span
              key={i}
              className="flex-1"
              style={{ textAlign: i === 0 ? 'left' : i === ticks.length - 1 ? 'right' : 'center' }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
