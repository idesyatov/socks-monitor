export interface Proxy {
  id: number
  name: string
  host: string
  port: number
  username?: string
  password?: string
  exit_ip?: string
  exit_ip_updated_at?: string
  enabled: boolean
  created_at: string
}

export interface Target {
  id: number
  url: string
  name: string
  enabled: boolean
}

export interface CheckResult {
  id: number
  proxy_id: number
  target_id: number
  status: 'up' | 'down' | 'error' | 'unknown'
  latency_ms: number | null
  error_msg?: string
  checked_at: string
}

export interface LatestCheckEntry {
  target: Target
  status: string
  latency_ms: number | null
  checked_at: string
}

export interface ProxyWithChecks {
  proxy: Proxy
  checks: LatestCheckEntry[]
}

export interface Settings {
  check_interval_sec: string
  check_timeout_sec: string
  history_retention_days: string
  exit_ip_service_url: string
}
