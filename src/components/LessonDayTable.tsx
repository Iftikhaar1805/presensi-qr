'use client'

import { useEffect } from 'react'
import * as api from '../lib/api'
import { useLoad } from '../lib/useLoad'
import { cn } from '../lib/utils'
import { Card, EmptyState, Mark, Spinner } from './ui'

/**
 * Tabel harian untuk wali kelas: setiap baris satu siswa, setiap kolom satu pelajaran yang sudah dipindai hari itu.
 * Siswa yang hadir pagi tetapi alpa di suatu pelajaran ditandai bolos dan dikumpulkan di bagian atas.
 */
export default function LessonDayTable({ classId, date, query }: { classId: number; date: string; query: string }) {
  const { data, loading, reload } = useLoad(() => api.getLessonDay(classId, date), [classId, date])

  // Guru mapel memindai di HP-nya, tabel wali kelas ikut berubah
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) void reload(true)
    }, 5000)
    return () => window.clearInterval(id)
  }, [reload])

  if (loading && !data) return <Spinner />
  if (!data) return null

  if (!data.subjects.length) {
    return (
      <Card>
        <EmptyState title="Belum ada pelajaran yang dipindai">
          Guru mata pelajaran memindai kartu lewat menu Scan dengan memilih pelajarannya. Hasilnya tampil di sini, satu kolom per pelajaran.
        </EmptyState>
      </Card>
    )
  }

  const q = query.trim().toLowerCase()
  const rows = data.rows.filter((r) => !q || r.student.name.toLowerCase().includes(q) || r.student.nis.includes(q))
  const bolos = data.rows.filter((r) => r.bolos.length)

  return (
    <div className="space-y-6">
      {bolos.length > 0 ? (
        <section className="border-l-4 border-ink-red bg-white p-4">
          <h2 className="display text-[1.7rem] text-ink-red">{bolos.length} siswa bolos</h2>
          <p className="mb-2 text-slate-600">Hadir pagi tadi, tetapi tidak ada di pelajaran berikut.</p>
          <ul className="space-y-1">
            {bolos.map((r) => (
              <li key={r.student.id} className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-bold text-slate-900">{r.student.name}</span>
                <span className="text-slate-600">tidak ada di {r.bolos.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="border-l-4 border-emerald-600 bg-white p-4 font-semibold text-emerald-800">Tidak ada siswa yang bolos hari ini.</p>
      )}

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-400 text-sm text-slate-600">
              <th className="sticky left-0 z-10 bg-slate-50 py-2 pr-2 font-semibold">Nama siswa</th>
              <th className="px-1 py-2 text-center font-semibold sm:px-2">Pagi</th>
              {data.subjects.map((s) => (
                <th key={s.id} className="px-1 py-2 text-center text-xs font-semibold sm:px-2 sm:text-sm">
                  <span className="block max-w-[4.6rem] leading-tight break-words sm:max-w-[5.5rem]">{s.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student.id} className={cn('border-b border-slate-200', r.bolos.length > 0 && 'bg-rose-50')}>
                <td className={cn('sticky left-0 z-10 max-w-[7.5rem] py-2.5 pr-2 text-sm leading-tight font-semibold sm:max-w-none sm:text-base', r.bolos.length ? 'bg-rose-50 text-ink-red' : 'bg-slate-50 text-slate-800')}>{r.student.name}</td>
                <td className="px-1 py-2.5 text-center sm:px-2">{r.daily ? <Mark status={r.daily} size="sm" /> : <span className="text-slate-300">–</span>}</td>
                {data.subjects.map((s) => {
                  const st = r.byLesson[s.id]
                  const skipped = st === 'alpa' && r.bolos.includes(s.name)
                  return (
                    <td key={s.id} className="px-1 py-2.5 text-center sm:px-2">
                      {st ? (
                        <span className={cn('inline-block', skipped && 'rounded-sm ring-2 ring-ink-red ring-offset-1')}>
                          <Mark status={st} size="sm" />
                        </span>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">H = hadir, I = izin, S = sakit, A = alpa. Kotak berbingkai merah = bolos. Tanda strip berarti belum dipindai.</p>
    </div>
  )
}
