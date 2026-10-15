import type { Status } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Tanggal lokal (WIB) format YYYY-MM-DD — jangan pakai toISOString karena UTC */
export function toDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, days: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) out.push(cur)
  return out
}

export function firstDayOfMonth(s: string = toDateStr()): string {
  return s.slice(0, 8) + '01'
}

export function isSunday(s: string): boolean {
  return parseDate(s).getDay() === 0
}

/** "07:15" -> menit sejak 00:00 */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function formatDateLong(s: string): string {
  return parseDate(s).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateShort(s: string): string {
  return parseDate(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export const STATUS_LIST: Status[] = ['hadir', 'terlambat', 'izin', 'sakit', 'alpa']

export const STATUS_META: Record<Status, { label: string; short: string; badge: string; dot: string; soft: string; text: string; border: string }> = {
  hadir: { label: 'Hadir', short: 'H', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-600', soft: 'bg-emerald-50 text-emerald-800', text: 'text-emerald-700', border: 'border-emerald-600' },
  terlambat: { label: 'Terlambat', short: 'T', badge: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500', soft: 'bg-amber-50 text-amber-900', text: 'text-amber-700', border: 'border-amber-500' },
  izin: { label: 'Izin', short: 'I', badge: 'bg-brand-100 text-brand-700', dot: 'bg-brand-500', soft: 'bg-brand-50 text-brand-700', text: 'text-brand-600', border: 'border-brand-500' },
  sakit: { label: 'Sakit', short: 'S', badge: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500', soft: 'bg-violet-50 text-violet-800', text: 'text-violet-700', border: 'border-violet-500' },
  alpa: { label: 'Alpa', short: 'A', badge: 'bg-rose-100 text-rose-800', dot: 'bg-ink-red', soft: 'bg-rose-50 text-rose-800', text: 'text-ink-red', border: 'border-ink-red' },
}

export function emptyCounts(): Record<Status, number> {
  return { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 }
}

/** Persentase kehadiran = (hadir + terlambat) / total hari tercatat */
export function attendanceRate(c: Record<Status, number>): number {
  const total = STATUS_LIST.reduce((a, s) => a + c[s], 0)
  if (!total) return 0
  return Math.round(((c.hadir + c.terlambat) / total) * 100)
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
