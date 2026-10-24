import { useQuery } from '../api/hooks'
import { PageHeader, Panel, StateBox } from '../ui/kit'

interface LinenStats {
  total: number
  in_stock: number
  at_client: number
  collected: number
  at_laundry: number
  washing: number
  drying: number
  pressing: number
  ready: number
  delivered: number
  missing: number
  damaged: number
  retired: number
  total_wash_cycles: number
  recently_scanned: number
}

const CIRCUIT = [
  { key: 'at_client', label: 'At client' },
  { key: 'collected', label: 'Collected' },
  { key: 'at_laundry', label: 'At laundry' },
  { key: 'washing', label: 'Washing' },
  { key: 'drying', label: 'Drying' },
  { key: 'pressing', label: 'Pressing' },
  { key: 'ready', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
] as const

export function DiscrepanciesPage() {
  const { data, error, loading, reload } = useQuery<LinenStats>('/linens/stats/summary')

  return (
    <>
      <PageHeader
        title="Discrepancies"
        subtitle="Missing and damaged pieces, against the rest of the circuit"
      />

      <StateBox loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Missing</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-red-900">{data.missing}</p>
                <p className="mt-1 text-xs text-red-700">Not seen on the last scan cycle</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Damaged</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-amber-900">{data.damaged}</p>
                <p className="mt-1 text-xs text-amber-700">Needs a repair or retire decision</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total tracked
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{data.total}</p>
                <p className="mt-1 text-xs text-slate-500">{data.total_wash_cycles} wash cycles</p>
              </div>
            </div>

            <Panel>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Where the rest of the linen is
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {CIRCUIT.map((stage) => (
                  <div key={stage.key} className="rounded-xl bg-slate-50 px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                      {stage.label}
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                      {data[stage.key]}
                    </dd>
                  </div>
                ))}
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">In stock</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums">{data.in_stock}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">Retired</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums">{data.retired}</dd>
                </div>
              </dl>
            </Panel>
          </div>
        ) : null}
      </StateBox>
    </>
  )
}
