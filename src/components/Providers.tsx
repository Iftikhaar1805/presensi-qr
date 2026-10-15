'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '../context/AuthContext'
import { SchoolProvider } from '../context/SchoolContext'
import { ToastProvider } from '../context/ToastContext'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SchoolProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </SchoolProvider>
  )
}
