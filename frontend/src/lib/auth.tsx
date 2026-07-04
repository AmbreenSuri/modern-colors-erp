import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokenStore, onUnauthorized } from './api'
import type { AuthUser, LoginResponse, Role } from '@/types/api'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasRole: (...roles: Role[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session from a stored token by fetching the current user.
    if (!tokenStore.get()) {
      setLoading(false)
      return
    }
    api
      .get<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => {
        tokenStore.clear()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => onUnauthorized(() => setUser(null)), [])

  const login = async (email: string, password: string) => {
    // Extra retries + a longer timeout: this is the first request from a mobile device
    // and may hit a cold-started, far-away (US) backend over a high-latency link.
    const res = await api.post<LoginResponse>(
      '/auth/login',
      { email, password },
      { retries: 3, timeoutMs: 25_000 },
    )
    tokenStore.set(res.accessToken)
    setUser(res.user)
  }

  const logout = () => {
    tokenStore.clear()
    setUser(null)
  }

  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
