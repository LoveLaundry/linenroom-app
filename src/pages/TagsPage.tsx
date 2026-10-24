import { useState, type FormEvent } from 'react'
import { dataApi, errorMessage } from '../api/client'
import { PageHeader, Panel } from '../ui/kit'

interface GeneratedTag {
  linen_id?: string
  id?: string
}

export function TagsPage() {
  const [category, setCategory] = useState('')
  const [itemType, setItemType] = useState('')
  const [clientName, setClientName] = useState('')
  const [quantity, setQuantity] = useState('10')
  const [size, setSize] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<GeneratedTag[] | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const count = Number(quantity)
    if (!category.trim() || !itemType.trim() || !clientName.trim() || !Number.isFinite(count) || count < 1) {
      setError('Category, item type, client and a quantity of at least 1 are required.')
      return
    }

    setBusy(true)
    setError(null)
    setCreated(null)
    try {
      const response = await dataApi.post<GeneratedTag[]>('/linens/generate-tags', {
        category: category.trim(),
        item_type: itemType.trim(),
        client_name: clientName.trim(),
        quantity: count,
        size: size.trim() || undefined,
      })
      setCreated(Array.isArray(response.data) ? response.data : [])
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Tags" subtitle="Register new pieces and mint their tags" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Panel>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category" value={category} onChange={setCategory} placeholder="Bed linen" />
            <Field label="Item type" value={itemType} onChange={setItemType} placeholder="King sheet" />
            <Field label="Client" value={clientName} onChange={setClientName} placeholder="Hotel name" />
            <Field label="Quantity" value={quantity} onChange={setQuantity} placeholder="10" numeric />
            <Field label="Size (optional)" value={size} onChange={setSize} placeholder="King" />
          </div>
        </Panel>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {created ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Created {created.length} tag{created.length === 1 ? '' : 's'}. They are now in inventory
            with status IN STOCK and can be scanned straight away.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Generating…' : 'Generate tags'}
        </button>
      </form>
    </>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  numeric?: boolean
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? 'numeric' : undefined}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
      />
    </label>
  )
}
