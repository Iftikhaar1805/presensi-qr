'use client'

import { useAuth } from '../context/AuthContext'
import { Navigate } from '../lib/nav'
import { homeFor } from '../views/LoginPage'
import { Spinner } from './ui'

/** Alamat dasar dan alamat yang tidak dikenal: arahkan ke beranda sesuai peran, atau ke halaman masuk. */
export default function Home() {
  const { user, ready } = useAuth()
  if (!ready) return <Spinner className="min-h-screen" />
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />
}
