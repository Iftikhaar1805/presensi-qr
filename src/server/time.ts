// Semua tanggal dan jam memakai WIB, tidak peduli zona waktu laptop yang menjalankan server.
const pad = (n: number) => String(n).padStart(2, '0')

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export function wib(now: Date = new Date()): { date: string; time: string } {
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}` }
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d))
}

export function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function addDays(s: string, days: number): string {
  const d = parseDate(s)
  d.setUTCDate(d.getUTCDate() + days)
  return toDateStr(d)
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) out.push(cur)
  return out
}

export function isSunday(s: string): boolean {
  return parseDate(s).getUTCDay() === 0
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}
