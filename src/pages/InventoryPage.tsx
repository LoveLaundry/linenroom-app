import { useState } from 'react'
import { useQuery } from '../api/hooks'
import { PageHeader, StateBox, StatusChip, Table } from '../ui/kit'

interface Linen {
  id: string
  linen_id: string
  item_type: string
  category: string
  client_name: string
  status: string
  condition: string
  location?: string | null
}

interface Response {
  items: Linen[]
  total: number
}

const STATUSES = [
  '',
  'IN_STOCK',
  'AT_CLIENT',
  'COLLECTED',
  'AT_LAUNDRY',
  'WASHING',
  'READY',
  'DELIVERED',
  'MISSING',
  'DAMAGED',
]

export function InventoryPage() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')

  const { data, error, loading, reload } = useQuery<Response>('/linens', {
    limit: 100,
    status: status || undefined,
    search: applied || undefined,
  })

  return (
    <>
      <PageHeader title="Inventory" subtitle="Where every tagged piece is right now" />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          setApplied(search.trim())
        }}
        className="mb-4 flex flex-wrap gap-2"
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tag, item or client"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value ? value.replaceAll('_', ' ') : 'All statuses'}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Filter
        </button>
      </form>

      <StateBox loading={loading} error={error} empty={data?.items.length === 0} onRetry={reload}>
        <Table head={['Tag', 'Item', 'Client', 'Location', 'Condition', 'Status']}>
          {(data?.items ?? []).map((linen) => (
            <tr key={linen.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs">{linen.linen_id}</td>
              <td className="px-4 py-3">
                <span className="font-medium">{linen.item_type}</span>
                <span className="ml-2 text-xs text-slate-500">{linen.category}</span>
              </td>
              <td className="px-4 py-3 text-slate-600">{linen.client_name}</td>
              <td className="px-4 py-3 text-slate-600">{linen.location || '—'}</td>
              <td className="px-4 py-3 text-slate-600">{linen.condition}</td>
              <td className="px-4 py-3">
                <StatusChip status={linen.status} />
              </td>
            </tr>
          ))}
        </Table>
        {data ? (
          <p className="mt-3 text-xs text-slate-500">
            Showing {data.items.length} of {data.total} pieces.
          </p>
        ) : null}
      </StateBox>
    </>
  )
}
