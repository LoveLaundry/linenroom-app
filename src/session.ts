/**
 * Session storage for this app only.
 *
 * Each app uses its own key (`ll_linen_session`) instead of the shared
 * `ll_token` used by the laundry app. If two apps are ever served from one
 * host, neither can read the other's session or hand a token to the wrong API.
 */
export interface SessionUser {
  name: string
  role: string
  laundry?: string
  /** Hotel name — only ever set for client sessions. */
  clientName?: string
}

export interface Session {
  token: string
  user: SessionUser
}

const KEY = 'll_linen_session'

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    if (!parsed?.token || !parsed?.user) return null
    return parsed
  } catch {
    return null
  }
}

export function writeSession(session: Session): void {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(KEY)
}

export function getToken(): string | null {
  return readSession()?.token ?? null
}

/** True when the JWT has already expired, so the UI can drop it before a 401. */
export function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''))
    return typeof payload?.exp === 'number' && payload.exp * 1000 < Date.now()
  } catch {
    return false
  }
}
