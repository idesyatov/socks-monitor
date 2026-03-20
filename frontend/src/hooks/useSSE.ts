import { useEffect, useRef } from 'react'

interface SSECallbacks {
  onCheckComplete?: (data: Record<string, unknown>) => void
  onCheckStarted?: (data: Record<string, unknown>) => void
  onExitIPResolved?: (data: Record<string, unknown>) => void
}

export function useSSE(callbacks: SSECallbacks) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource('/api/events')

      es.addEventListener('check_complete', (e) => {
        try {
          const data = JSON.parse(e.data)
          cbRef.current.onCheckComplete?.(data)
        } catch {}
      })

      es.addEventListener('check_started', (e) => {
        try {
          const data = JSON.parse(e.data)
          cbRef.current.onCheckStarted?.(data)
        } catch {}
      })

      es.addEventListener('exit_ip_resolved', (e) => {
        try {
          const data = JSON.parse(e.data)
          cbRef.current.onExitIPResolved?.(data)
        } catch {}
      })

      es.onerror = () => {
        es?.close()
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      es?.close()
      clearTimeout(reconnectTimer)
    }
  }, [])
}
