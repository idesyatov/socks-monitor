export function timeAgo(dateStr: string): string {
  if (!dateStr || dateStr === '0001-01-01T00:00:00Z') return 'never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const sec = Math.max(0, Math.floor(diff / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}
