import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  )
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5">{children}</div>
}

export function StateBox({
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  loading: boolean
  error: string | null
  empty?: boolean
  onRetry?: () => void
  children: ReactNode
}) {
  if (loading) {
    return (
      <Panel>
        <p className="text-sm text-slate-500">Loading…</p>
      </Panel>
    )
  }
  if (error) {
    return (
      <Panel>
        <p className="text-sm text-red-700">{error}</p>
        {onRetry ? (
          <button
            onClick={onRetry}
            className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Try again
          </button>
        ) : null}
      </Panel>
    )
  }
  if (empty) {
    return (
      <Panel>
        <p className="text-sm text-slate-500">Nothing here yet.</p>
      </Panel>
    )
  }
  return <>{children}</>
}

const STATUS_TONE: Record<string, string> = {
  RECEIVED: 'bg-sky-50 text-sky-700 border-sky-200',
  PROCESSING: 'bg-amber-50 text-amber-700 border-amber-200',
  READY_FOR_DELIVERY: 'bg-violet-50 text-violet-700 border-violet-200',
  PARTIALLY_DELIVERED: 'bg-orange-50 text-orange-700 border-orange-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ISSUED: 'bg-sky-50 text-sky-700 border-sky-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PARTIALLY_PAID: 'bg-orange-50 text-orange-700 border-orange-200',
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function StatusChip({ status }: { status: string | null | undefined }) {
  const value = (status ?? '').toUpperCase()
  const tone = STATUS_TONE[value] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {value.replaceAll('_', ' ') || '—'}
    </span>
  )
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {head.map((label) => (
              <th key={label} className="px-4 py-3 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}
