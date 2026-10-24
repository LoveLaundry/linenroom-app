import { useState, type FormEvent } from 'react'
import { dataApi, errorMessage } from '../api/client'
import { PageHeader, Panel, StatusChip } from '../ui/kit'

interface Linen {
  id: string
  linen_id: string
  category: string
  item_type: string
  client_name: string
  status: string
  condition: string
  location?: string | null
  wash_count?: number
}

/** The statuses a scan may move a piece to, exactly as the API defines them. */
const ACTIONS: Array<{ action: string; label: string }> = [
  { action: 'collect', label: 'Collect' },
  { action: 'receive', label: 'Receive' },
  { action: 'start_wash', label: 'Start wash' },
  { action: 'complete_wash', label: 'Complete wash' },
  { action: 'press', label: 'Press' },
  { action: 'ready', label: 'Ready' },
  { action: 'deliver', label: 'Deliver' },
  { action: 'mark_missing', label: 'Missing' },
  { action: 'mark_damaged', label: 'Damaged' },
]

export function ScanPage() {
  const [code, setCode] = useState('')
  const [linen, setLinen] = useState<Linen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function lookup(event: FormEvent) {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    setLinen(null)
    try {
      const response = await dataApi.get<Linen>(`/linens/by-code/${encodeURIComponent(trimmed)}`)
      setLinen(response.data)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function apply(action: string) {
    if (!linen || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await dataApi.post<{ status?: string }>(`/linens/${linen.id}/scan`, {
        action,
      })
      const nextStatus = response.data?.status ?? action
      setLinen({ ...linen, status: nextStatus })
      setNotice(`Applied "${action}" to ${linen.linen_id}.`)
      setCode('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Scan" subtitle="Look up a tag, then move the piece on" />

      <form onSubmit={lookup} className="mb-4 flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Scan or type a tag, e.g. LL-000123"
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Working…' : 'Find'}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>
      ) : null}

      {linen ? (
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm text-slate-500">{linen.linen_id}</p>
              <h2 className="mt-1 text-lg font-semibold">
                {linen.item_type} · {linen.category}
              </h2>
              <p className="text-sm text-slate-600">{linen.client_name}</p>
            </div>
            <div className="text-right">
              <StatusChip status={linen.status} />
              <p className="mt-2 text-xs text-slate-500">
                Condition {linen.condition} · {linen.wash_count ?? 0} washes
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACTIONS.map((entry) => (
              <button
                key={entry.action}
                onClick={() => void apply(entry.action)}
                disabled={busy}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                {entry.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            &quot;Retire&quot; is intentionally absent: retiring a piece is irreversible and stays a
            supervisor action in the management app.
          </p>
        </Panel>
      ) : null}
    </>
  )
}
