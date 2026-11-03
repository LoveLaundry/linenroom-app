import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { dataApi, errorMessage } from '../api/client'
import { refreshLiveClock, useLiveClock } from '../api/hooks'
import { useQrScanner } from '../camera/useQrScanner'
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
  last_scanned_date?: string | null
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
  const [cameraOpen, setCameraOpen] = useState(false)

  // Kept in a ref so the live-refresh effect can read the currently displayed
  // doc without re-subscribing every time the record changes.
  const shownIdRef = useRef<string | null>(null)
  shownIdRef.current = linen?.id ?? null

  /** Load a tag straight from the API. Used by both the form and the camera. */
  const lookup = useCallback(async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await dataApi.get<Linen>(
        `/linens/by-code/${encodeURIComponent(trimmed)}`,
      )
      setLinen(response.data)
    } catch (caught) {
      setLinen(null)
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }, [])

  const scan = useQrScanner((decoded) => {
    setCode(decoded)
    void lookup(decoded)
  })

  // Start only once the preview is in the tree. Calling start() from the click
  // handler raced the render: the hook could acquire the stream before the
  // <video> existed and then release it again, so the camera opened and closed
  // without ever decoding a frame.
  const { start: startCamera, stop: stopCamera } = scan
  useEffect(() => {
    if (!cameraOpen) {
      stopCamera()
      return
    }
    void startCamera()
  }, [cameraOpen, startCamera, stopCamera])

  /**
   * Re-read the displayed piece when another session changes it.
   *
   * The scan endpoint already returns the updated record, so this only matters
   * for changes made elsewhere — a second scanner, or the management app.
   */
  const clock = useLiveClock()
  const seenClock = useRef<number | null>(null)

  useEffect(() => {
    if (clock === null) return
    if (seenClock.current === null) {
      seenClock.current = clock
      return
    }
    if (clock === seenClock.current) return
    seenClock.current = clock

    const id = shownIdRef.current
    if (!id) return
    void (async () => {
      try {
        const response = await dataApi.get<Linen>(`/linens/${id}`)
        setLinen(response.data)
      } catch {
        // The piece may have been deleted by whoever moved the clock; leave the
        // screen as-is and let the next explicit lookup report it.
      }
    })()
  }, [clock])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    void lookup(code)
  }

  async function apply(action: string) {
    if (!linen || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await dataApi.post<Linen>(`/linens/${linen.id}/scan`, { action })
      // Trust the server's record rather than patching the local copy: the
      // response carries the real status plus wash_count and timestamps that a
      // local merge would silently lose.
      if (response.data?.id) {
        setLinen(response.data)
      }
      setNotice(`Applied "${action}" to ${linen.linen_id}.`)
      setCode('')
      // Nudge other screens immediately instead of waiting for their next poll.
      refreshLiveClock()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Scan" subtitle="Look up a tag, then move the piece on" />

      <form onSubmit={submit} className="mb-4 flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Scan or type a tag, e.g. LL-7K4P92"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Working…' : 'Find'}
        </button>
        <button
          type="button"
          onClick={() => setCameraOpen((open) => !open)}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
        >
          {cameraOpen ? 'Stop camera' : 'Camera'}
        </button>
      </form>

      {cameraOpen ? (
        <Panel>
          <div className="relative overflow-hidden rounded-xl bg-slate-950">
            <video
              ref={scan.videoRef}
              muted
              autoPlay
              playsInline
              className="aspect-video w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-40 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {scan.state === 'scanning'
              ? 'Hold the tag inside the frame. Scanned codes fill the field above.'
              : scan.state === 'starting'
                ? 'Starting the camera…'
                : (scan.message ?? 'Camera idle.')}
            {scan.state === 'scanning' && scan.decoder
              ? ` Decoder: ${scan.decoder === 'native' ? 'browser' : 'built-in'}.`
              : ''}
          </p>
        </Panel>
      ) : null}

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
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
