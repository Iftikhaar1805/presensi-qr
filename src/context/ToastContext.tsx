'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'

type Kind = 'success' | 'error'
interface Toast {
  id: number
  kind: Kind
  message: string
}

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => {})

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, kind: Kind = 'success') => {
    const id = ++counter
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex max-w-md items-center gap-2.5 rounded-md px-4 py-3 font-semibold',
              t.kind === 'success' ? 'bg-slate-900 text-white' : 'bg-ink-red text-white',
            )}
          >
            {t.kind === 'success' ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" /> : <XCircle className="size-4 shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}
