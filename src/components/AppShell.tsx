'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from '../lib/nav'
import Layout from './Layout'
import { Spinner } from './ui'

/** Semua halaman setelah login: menunggu sesi dibaca, mengarahkan ke login bila belum masuk, lalu memasang kerangka. */
export default function AppShell({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (ready && !user) navigate('/login', { replace: true })
  }, [ready, user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready || !user) return <Spinner className="min-h-screen" />
  return <Layout>{children}</Layout>
}
