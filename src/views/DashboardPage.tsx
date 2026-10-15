'use client'

import { ScanLine } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from '../lib/nav'
import Cells, { CELL } from '../components/Cells'
import Illustration from '../components/Illustration'
import { Button, Mark, Spinner } from '../components/ui'
import { useUser } from '../context/AuthContext'
import * as api from '../lib/api'
import { useLoad } from '../lib/useLoad'
import { STATUS_LIST, STATUS_META, cn, formatDateLong, toDateStr } from '../lib/utils'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export default function DashboardPage() {
  const user = useUser()
  const today = toDateStr()
  const { data, reload } = useLoad(() => api.getDashboard(today), [today])
  const recent = useLoad(() => api.getRecentScans(8), [])

  // Papan diperbarui sendiri: begitu guru scan di HP-nya, kotak di sini ikut terisi
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return
      void reload(true)
      void recent.reload(true)
    }, 4000)
    return () => window.clearInterval(id)
  }, [reload, recent])

  if (!data) return <Spinner />

  const present = data.counts.hadir + data.counts.terlambat

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-slate-600">
        <p>
          {greeting()}, {user.name.split(',')[0]}. {formatDateLong(today)}.
        </p>
        <p className="inline-flex items-center gap-2 text-sm">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-600" />
          </span>
          Diperbarui otomatis
        </p>
      </div>

      {/* Satu kalimat jawaban: sudah berapa yang datang */}
      <div className="mt-3 mb-9 flex flex-col gap-6 border-b-2 border-brand-900 pb-7 sm:flex-row sm:items-end sm:justify-between">
        {data.open ? (
          <div>
            <h1 className="display text-[3.3rem] leading-[0.95] text-brand-900 sm:text-[5.2rem]">
              <span className="stabilo">{present}</span> dari {data.totalStudents} siswa
              <br />
              sudah datang
            </h1>
            <p className="mt-4 text-lg text-slate-700">
              <b className="text-orange-600">{data.counts.terlambat} terlambat</b>
              {data.notYet > 0 ? (
                <>
                  , <b>{data.notYet} belum tercatat</b>.
                </>
              ) : (
                <>
                  , <b className="text-ink-red">{data.counts.alpa} alpa</b>.
                </>
              )}
            </p>
          </div>
        ) : (
          <div>
            <Illustration name="libur" className="mb-3 h-24 object-contain object-left" />
            <h1 className="display text-[3.3rem] leading-[0.95] text-brand-900 sm:text-[5.2rem]">Hari ini libur</h1>
            <p className="mt-4 text-lg text-slate-700">{data.closedReason}. Presensi tidak dibuka.</p>
          </div>
        )}
        {data.open && (
          <Link to="/scan" className="shrink-0">
            <Button size="lg" icon={<ScanLine className="size-6" />} className="w-full">
              Mulai absen
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <h2 className="display text-[1.9rem] text-brand-900">Papan kehadiran</h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {STATUS_LIST.map((s) => (
                <li key={s} className="inline-flex items-center gap-1.5">
                  <span className={cn('size-3 rounded-[2px]', CELL[s])} /> {STATUS_META[s].label}
                </li>
              ))}
              <li className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-[2px] bg-white ring-1 ring-slate-300 ring-inset" /> Belum datang
              </li>
            </ul>
          </div>

          <ul className="border-t border-slate-300">
            {data.perClass.map((p) => {
              const hadir = p.counts.hadir + p.counts.terlambat
              return (
                <li key={p.cls.id} className="border-b border-slate-300">
                  <Link to={`/rekap-harian?kelas=${p.cls.id}`} className="grid gap-x-5 gap-y-3 py-4 hover:bg-white sm:grid-cols-[minmax(4.6rem,auto)_minmax(0,1fr)_auto] sm:items-start">
                    <p className="display text-[2.6rem] leading-none text-brand-900">{p.cls.name}</p>
                    <div className="min-w-0 space-y-2.5">
                      <p className="truncate text-sm text-slate-600">
                        {p.teaching ? (
                          <>
                            <b className="text-brand-900">{p.teaching.subjectName}</b>, {p.teaching.teacherName}, sejak {p.teaching.since}
                          </>
                        ) : (
                          <>
                            <b className="text-slate-500">Kosong</b>, wali kelas {p.homeroom}
                          </>
                        )}
                      </p>
                      <Cells cells={p.cells} />
                    </div>
                    <p className="display text-right text-[2.1rem] leading-none text-brand-900 max-sm:order-first max-sm:-mt-9 max-sm:self-end">
                      {hadir}
                      <span className="text-slate-400">/{p.total}</span>
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-sm text-slate-500">Ketuk satu kelas untuk melihat nama siswa dan mengubah status izin atau sakit.</p>
        </section>

        <section className="min-w-0">
          <h2 className="display mb-3 text-[1.9rem] text-brand-900">Absen terakhir</h2>
          {recent.data && recent.data.length ? (
            <ul className="border-t border-slate-300">
              {recent.data.map((r) => (
                <li key={r.attendance.id} className="flex items-baseline gap-3 border-b border-slate-200 py-2.5">
                  <span className="display w-14 shrink-0 text-xl text-brand-900">{r.attendance.checkInTime?.slice(0, 5)}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{r.student.name}</span>
                  <span className="shrink-0 text-sm text-slate-500">{r.className}</span>
                  <Mark status={r.attendance.status} size="sm" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-t border-slate-300 pt-4">
              <Illustration name="kosong-absen" className="mb-3 h-28 object-contain object-left" />
              <p className="text-slate-500">Belum ada siswa yang absen. Daftar akan terisi begitu kartu pertama di-scan.</p>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
