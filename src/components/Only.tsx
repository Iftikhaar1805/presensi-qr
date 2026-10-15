'use client'

import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate } from '../lib/nav'
import type { Role } from '../lib/types'
import { homeFor } from '../views/LoginPage'

/** Halaman hanya untuk peran tertentu; yang lain diarahkan ke beranda masing-masing. */
export default function Only({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return null
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />
  return <>{children}</>
}
