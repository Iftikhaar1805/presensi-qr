'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import type { User } from '../lib/types'

interface AuthState {
  user: User | null
  /** false sampai sesi di browser selesai dibaca */
  ready: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => void
  /** Dipanggil setelah password diganti agar peringatan hilang */
  markPasswordChanged: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setUser(api.readSession()?.user ?? null)
    setReady(true)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const session = await api.login(username, password)
    api.writeSession(session)
    setUser(session.user)
    return session.user
  }, [])

  const logout = useCallback(() => {
    api.writeSession(null)
    setUser(null)
  }, [])

  const markPasswordChanged = useCallback(() => {
    setUser((u) => {
      if (!u) return u
      const next = { ...u, weakPassword: false }
      const session = api.readSession()
      if (session) api.writeSession({ ...session, user: next })
      return next
    })
  }, [])

  // Token ditolak server (kedaluwarsa atau akun dihapus): kembali ke halaman masuk
  useEffect(() => {
    window.addEventListener(api.SESSION_EXPIRED_EVENT, logout)
    return () => window.removeEventListener(api.SESSION_EXPIRED_EVENT, logout)
  }, [logout])

  return <AuthContext.Provider value={{ user, ready, login, logout, markPasswordChanged }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}

/** Untuk halaman yang pasti sudah login */
// eslint-disable-next-line react-refresh/only-export-components
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('Belum login')
  return user
}
