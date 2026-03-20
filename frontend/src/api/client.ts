import type { Proxy, Target, ProxyWithChecks, CheckResult, Settings } from '../types'

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// Proxies
export const getProxies = () => request<Proxy[]>('/proxies')
export const createProxy = (data: Partial<Proxy>) =>
  request<Proxy>('/proxies', { method: 'POST', body: JSON.stringify(data) })
export const updateProxy = (id: number, data: Partial<Proxy>) =>
  request<Proxy>(`/proxies/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteProxy = (id: number) =>
  request<void>(`/proxies/${id}`, { method: 'DELETE' })

// Targets
export const getTargets = () => request<Target[]>('/targets')
export const createTarget = (data: Partial<Target>) =>
  request<Target>('/targets', { method: 'POST', body: JSON.stringify(data) })
export const updateTarget = (id: number, data: Partial<Target>) =>
  request<Target>(`/targets/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteTarget = (id: number) =>
  request<void>(`/targets/${id}`, { method: 'DELETE' })

// Checks
export const runChecks = (proxyId?: number) =>
  request<{ status: string }>('/checks/run', {
    method: 'POST',
    body: proxyId ? JSON.stringify({ proxy_id: proxyId }) : undefined,
  })
export const getLatestChecks = () => request<ProxyWithChecks[]>('/checks/latest')
export const getCheckHistory = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return request<CheckResult[]>(`/checks/history${qs}`)
}

// Settings
export const getSettings = () => request<Settings>('/settings')
export const updateSettings = (data: Partial<Settings>) =>
  request<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) })

// Exit IP
export const resolveAllExitIPs = () =>
  request<{ status: string }>('/proxies/resolve-ip', { method: 'POST' })
export const resolveExitIP = (id: number) =>
  request<{ status: string }>(`/proxies/${id}/resolve-ip`, { method: 'POST' })
