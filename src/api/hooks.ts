import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dataApi, errorMessage } from './client'

type Params = Record<string, string | number | undefined>

interface QueryResult<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

/**
 * Minimal GET hook.
 *
 * Deliberately not react-query: three screens do not justify the dependency,
 * and this keeps the refresh semantics obvious. The request key is serialised
 * so a fresh object literal on every render does not refetch in a loop.
 */
export function useQuery<T>(path: string, params?: Params): QueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const key = useMemo(() => JSON.stringify(params ?? {}), [params])
  const pathRef = useRef(path)
  pathRef.current = path

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await dataApi.get<T>(pathRef.current, {
        params: JSON.parse(key) as Params,
      })
      setData(response.data)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    void load()
  }, [load])

  return { data, error, loading, reload: () => void load() }
}

/* ── live clock ──────────────────────────────────────────────────────────────
 * The API increments a per-laundry counter on every linen mutation and exposes
 * it at GET /linens/live-clock. Screens poll that counter and refetch the
 * moment it moves, which is what makes a scan on one device appear on another
 * without a manual refresh.
 *
 * One poller is shared by every mounted component: five screens subscribing
 * must not mean five requests every tick.
 */
const LIVE_POLL_MS = 1000

let clockValue: number | null = null
let pollTimer: number | undefined
let pollStarted = false
let pollInFlight = false
const listeners = new Set<(clock: number) => void>()

/**
 * Tabs and windows on the same browser share the counter over a channel, so a
 * scan in one updates the other without waiting for the next poll. This does
 * nothing across devices — that is the poll's job — but it removes the most
 * visible lag, which is two windows side by side on one machine.
 */
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lovelaundry-live') : null

function notify(next: number, broadcast = true): void {
  clockValue = next
  for (const listener of listeners) listener(next)
  if (broadcast) channel?.postMessage(next)
}

if (channel) {
  channel.addEventListener('message', (event: MessageEvent) => {
    const next = Number(event.data)
    if (Number.isFinite(next) && next !== clockValue) notify(next, false)
  })
}

function schedulePoll(): void {
  if (pollTimer !== undefined) window.clearTimeout(pollTimer)
  pollTimer = window.setTimeout(() => void pollOnce(), LIVE_POLL_MS)
}

async function pollOnce(): Promise<void> {
  if (pollInFlight) return
  // A hidden tab has no one watching; polling it just burns requests.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    schedulePoll()
    return
  }
  pollInFlight = true
  try {
    const response = await dataApi.get<{ clock?: number }>('/linens/live-clock')
    const next = Number(response.data?.clock ?? 0)
    if (!Number.isFinite(next)) return
    // Only notify on a real change, otherwise every consumer refetches every tick.
    if (clockValue === null || next !== clockValue) notify(next)
  } catch {
    // A failed poll is not worth surfacing: the next tick retries, and the
    // screen's own error state already covers a genuinely broken connection.
  } finally {
    pollInFlight = false
    schedulePoll()
  }
}

function ensurePoller(): void {
  if (pollStarted) return
  pollStarted = true
  schedulePoll()
  // A hidden tab stops polling; coming back must not wait a full interval for
  // the first update, or the screen looks stale exactly when someone returns to
  // it. Both events are used because focus does not fire for a background tab
  // restored from the tab strip in every browser.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshLiveClock()
    })
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => refreshLiveClock())
  }
}

/** Force an immediate clock check, e.g. right after this tab mutates data. */
export function refreshLiveClock(): void {
  if (pollTimer !== undefined) window.clearTimeout(pollTimer)
  void pollOnce()
}

/** The current per-laundry revision, or null before the first successful poll. */
export function useLiveClock(): number | null {
  const [clock, setClock] = useState<number | null>(clockValue)

  useEffect(() => {
    const listener = (next: number) => setClock(next)
    listeners.add(listener)
    ensurePoller()
    if (clockValue !== null) setClock(clockValue)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return clock
}

/**
 * `useQuery` plus live refresh: refetches whenever another session scans,
 * updates or deletes a linen in this laundry.
 */
export function useLiveQuery<T>(path: string, params?: Params): QueryResult<T> {
  const result = useQuery<T>(path, params)
  const clock = useLiveClock()

  // The clock seen at first load is the baseline; only a later value means
  // somebody changed something. Capturing it in a ref keeps the effect from
  // refetching on every render.
  const baseline = useRef<number | null>(null)
  const reloadRef = useRef(result.reload)
  reloadRef.current = result.reload

  useEffect(() => {
    if (clock === null) return
    if (baseline.current === null) {
      baseline.current = clock
      return
    }
    if (clock !== baseline.current) {
      baseline.current = clock
      reloadRef.current()
    }
  }, [clock])

  return result
}

export function formatMoney(value: number | string | null | undefined, currency = 'LKR'): string {
  const amount = typeof value === 'string' ? Number(value) : (value ?? 0)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function pieces(items: unknown): number {
  if (!Array.isArray(items)) return 0
  return items.reduce((total, raw) => {
    const item = raw as Record<string, unknown>
    const qty = Number(item.client_qty ?? item.received_qty ?? item.quantity ?? 0)
    return total + (Number.isFinite(qty) ? qty : 0)
  }, 0)
}
