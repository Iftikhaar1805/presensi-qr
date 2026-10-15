'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import type { SchoolConfig } from '../lib/types'

interface SchoolState {
  /** Nama sekolah dari Pengaturan (kosong sampai data termuat) */
  name: string
  /** Logo sekolah sebagai data URL, atau null jika belum diunggah */
  logo: string | null
  /** Tombol akun contoh di halaman masuk */
  demoAccounts: boolean
  loaded: boolean
  reload: () => Promise<void>
}

const SchoolContext = createContext<SchoolState | null>(null)

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SchoolConfig | null>(null)

  const reload = useCallback(async () => {
    try {
      setConfig(await api.getConfig())
    } catch {
      // Server belum bisa dihubungi: halaman tetap tampil tanpa nama dan logo
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <SchoolContext.Provider value={{ name: config?.schoolName ?? '', logo: config?.logo ?? null, demoAccounts: config?.demoAccounts ?? false, loaded: config !== null, reload }}>
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool(): SchoolState {
  const ctx = useContext(SchoolContext)
  if (!ctx) throw new Error('useSchool harus dipakai di dalam SchoolProvider')
  return ctx
}
