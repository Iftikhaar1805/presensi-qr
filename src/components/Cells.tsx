'use client'

import type { Status } from '../lib/types'
import { cn } from '../lib/utils'

/** Warna kotak per status, dipakai Papan kehadiran dan halaman Scan. */
export const CELL: Record<Status, string> = {
  hadir: 'bg-emerald-600',
  terlambat: 'bg-orange-500',
  izin: 'bg-brand-500',
  sakit: 'bg-violet-500',
  alpa: 'bg-ink-red',
}

/** Satu kotak per siswa. Kotak kosong = belum datang. Terisi warna begitu kartunya di-scan. */
export default function Cells({ cells, size = 'md' }: { cells: (Status | null)[]; size?: 'md' | 'lg' }) {
  return (
    <div className="flex flex-wrap gap-[3px]" aria-hidden>
      {cells.map((st, i) => (
        <span
          key={i}
          className={cn('rounded-[2px]', size === 'lg' ? 'size-[1.5rem]' : 'size-[0.95rem] sm:size-[1.15rem]', st ? CELL[st] : 'bg-white ring-1 ring-slate-300 ring-inset')}
        />
      ))}
    </div>
  )
}
