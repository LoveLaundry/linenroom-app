import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '../api/client'
import { appConfig } from '../config/app'
import {
  clearSession,
  isExpired,
  readSession,
  writeSession,
  type Session,
  type SessionUser,
} from '../session'

interface SignInInput {
  username: string
  password: string
}

interface AuthValue {
  session: Session | null
  user: SessionUser | null
  isAuthenticated: boolean
  signIn: (input: SignInInput) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

/** Shape a staff `/auth/login` response. */
function staffUser(user: Record<string, unknown>): SessionUser {
  return {
    name: String(user.user_name ?? user.auth_id ?? 'Staff'),
    role: String(user.role_id ?? user.role ?? '').toUpperCase(),
    laundry: user.laundry_id ? String(user.laundry_id) : undefined,
  }
}

/** Shape a hotel `/client/auth/login` response. */
function clientUser(client: Record<string, unknown>): SessionUser {
  return {
    name: String(client.user_name ?? client.auth_id ?? 'Hotel'),
    role: String(client.role_id ?? '').toUpperCase(),
    laundry: client.laundry_id ? String(client.laundry_id) : undefined,
    clientName: client.client_name ? String(client.client_name) : undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const stored = readSession()
    if (stored && isExpired(stored.token)) {
      clearSession()
      return null
    }
    return stored
  })

  const signOut = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const signIn = useCallback(async ({ username, password }: SignInInput) => {
    const isClient = appConfig.authKind === 'client'
    const body = isClient
      ? { auth_id: username.trim(), password }
      : { username: username.trim(), password }

    const { data } = await authApi.post(appConfig.loginPath, body)
    const user = isClient
      ? clientUser(data.client as Record<string, unknown>)
      : staffUser(data.user as Record<string, unknown>)

    // A hotel session must never be stored without knowing which hotel it is:
    // every query is filtered by that name, so an empty one would silently
    // return nothing (or, worse, be trusted as a wildcard by a future endpoint).
    if (isClient && !user.clientName) {
      throw new Error('This account is not linked to a hotel. Contact your provider.')
    }

    const next: Session = { token: String(data.access_token), user }
    writeSession(next)
    setSession(next)
  }, [])

  // Confirm the stored session is still valid server-side. A 401 clears it via
  // the interceptor; a 403 (suspended account) must also end the session.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    authApi
      .get(appConfig.statusPath)
      .catch((error: unknown) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (!cancelled && (status === 401 || status === 403)) signOut()
      })
    return () => {
      cancelled = true
    }
    // Run once per token, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      signIn,
      signOut,
    }),
    [session, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
