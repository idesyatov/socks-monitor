import { useState, useEffect } from 'react'
import type { Proxy, Target, Settings as SettingsType } from '../types'
import * as api from '../api/client'

export default function Settings() {
  return (
    <div className="space-y-8">
      <ProxiesSection />
      <TargetsSection />
      <SettingsSection />
    </div>
  )
}

function ProxiesSection() {
  const [proxies, setProxies] = useState<Proxy[]>([])
  const [form, setForm] = useState({ name: '', host: '', port: '', username: '', password: '' })

  const load = async () => {
    try { setProxies(await api.getProxies()) } catch {}
  }
  useEffect(() => { load() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createProxy({ ...form, port: parseInt(form.port) || 0 })
      setForm({ name: '', host: '', port: '', username: '', password: '' })
      load()
    } catch {}
  }

  const handleDelete = async (id: number) => {
    try { await api.deleteProxy(id); load() } catch {}
  }

  const handleToggle = async (p: Proxy) => {
    try { await api.updateProxy(p.id, { enabled: !p.enabled }); load() } catch {}
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Proxies</h2>
      <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Host:Port</th>
              <th className="px-4 py-2 text-left">Exit IP</th>
              <th className="px-4 py-2 text-center">Enabled</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {proxies.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{p.name || '—'}</td>
                <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">{p.host}:{p.port}</td>
                <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">{p.exit_ip || '—'}</td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => handleToggle(p)} className={`w-8 h-5 rounded-full relative transition-colors ${p.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`block w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${p.enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {proxies.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400 dark:text-gray-500">No proxies</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-1.5 text-sm w-32" />
        <input placeholder="Host" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-1.5 text-sm w-40" required />
        <input placeholder="Port" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-1.5 text-sm w-20" type="number" required />
        <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-1.5 text-sm w-28" />
        <input placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-1.5 text-sm w-28" type="password" />
        <button type="submit" className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm font-medium">Add</button>
      </form>
    </section>
  )
}

function TargetsSection() {
  const [targets, setTargets] = useState<Target[]>([])
  const [form, setForm] = useState({ name: '', url: '' })

  const load = async () => {
    try { setTargets(await api.getTargets()) } catch {}
  }
  useEffect(() => { load() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createTarget(form)
      setForm({ name: '', url: '' })
      load()
    } catch {}
  }

  const handleDelete = async (id: number) => {
    try { await api.deleteTarget(id); load() } catch {}
  }

  const handleToggle = async (t: Target) => {
    try { await api.updateTarget(t.id, { enabled: !t.enabled }); load() } catch {}
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Targets</h2>
      <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">URL</th>
              <th className="px-4 py-2 text-center">Enabled</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {targets.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{t.name || '—'}</td>
                <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400 text-xs">{t.url}</td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => handleToggle(t)} className={`w-8 h-5 rounded-full relative transition-colors ${t.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`block w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${t.enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {targets.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-400 dark:text-gray-500">No targets</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-1.5 text-sm w-40" />
        <input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-1.5 text-sm flex-1 min-w-[10rem]" required />
        <button type="submit" className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm font-medium">Add</button>
      </form>
    </section>
  )
}

function SettingsSection() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try { setSettings(await api.getSettings() as SettingsType) } catch {}
  }
  useEffect(() => { load() }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    try { await api.updateSettings(settings); } catch {}
    setSaving(false)
  }

  if (!settings) return null

  const field = (label: string, key: keyof SettingsType) => (
    <div>
      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        value={settings[key]}
        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-1.5 text-sm w-full"
      />
    </div>
  )

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h2>
      <form onSubmit={handleSave} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 max-w-md">
        <div className="space-y-3">
          {field('Check interval (sec)', 'check_interval_sec')}
          {field('Check timeout (sec)', 'check_timeout_sec')}
          {field('History retention (days)', 'history_retention_days')}
          {field('Exit IP service URL', 'exit_ip_service_url')}
        </div>
        <button type="submit" disabled={saving} className="mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </section>
  )
}
