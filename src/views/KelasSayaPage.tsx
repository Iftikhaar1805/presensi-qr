'use client'

import { useEffect, useState } from 'react'
import { Link } from '../lib/nav'
import Cells from '../components/Cells'
import LessonDayTable from '../components/LessonDayTable'
import { Button, Mark, PageHeader, Select, Spinner } from '../components/ui'
import { useUser } from '../context/AuthContext'
import * as api from '../lib/api'
import type { Status } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { STATUS_LIST, STATUS_META, cn, emptyCounts, formatDateLong, toDateStr } from '../lib/utils'

/**
 * Halaman wali kelas: apa yang terjadi di kelasnya hari ini. Wali kelas tidak memindai sendiri;
 * kehadiran datang dari guru yang mengajar di kelas itu. Di sini wali kelas melihat siapa mengajar, siapa hadir, dan siapa bolos.
 */
export default function KelasSayaPage() {
  const user = useUser()
  const today = toDateStr()
  const classes = useLoad(api.getClasses, [])
  const [picked, setPicked] = useState(0)
  const own = classes.data?.find((c) => c.homeroomTeacherId === user.teacherId)
  const classId = picked || own?.id || classes.data?.[0]?.id || 0
  const cls = classes.data?.find((c) => c.id === classId)

  const daily = useLoad(() => (classId ? api.getDaily(today, classId) : Promise.resolve([])), [classId, today])
  const sessions = useLoad(() => (classId ? api.getSessionDay(classId, today) : Promise.resolve([])), [classId, today])
  const statuses = useLoad(api.getClassStatuses, [])
  const reloadDaily = daily.reload
  const reloadSessions = sessions.reload
  const reloadStatuses = statuses.reload

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return
      void reloadDaily(true)
      void reloadSessions(true)
      void reloadStatuses(true)
    }, 5000)
    return () => window.clearInterval(id)
  }, [reloadDaily, reloadSessions, reloadStatuses])

  if (!classes.data) return <Spinner />

  const rows = daily.data ?? []
  const counts = emptyCounts()
  let notYet = 0
  const cells: (Status | null)[] = rows.map((r) => {
    const st = r.attendance?.status ?? null
    // Alpa otomatis (tidak ada yang memindai) dihitung belum tercatat, bukan alpa sungguhan
    if (!st || (st === 'alpa' && r.attendance?.recordedBy === null)) {
      notYet++
      return null
    }
    counts[st]++
    return st
  })
  const live = statuses.data?.find((s) => s.cls.id === classId)?.active ?? null
  const showPicker = user.role === 'admin' || !own

  return (
    <>
      <PageHeader
        title={cls ? `Kelas ${cls.name}` : 'Kelas Saya'}
        subtitle={own && cls?.id === own.id ? `Anda wali kelas ${cls.name}. ${formatDateLong(today)}.` : formatDateLong(today)}
        actions={
          <>
            <Link to={`/rekap-harian?kelas=${classId}`}>
              <Button variant="secondary">Ubah izin atau sakit</Button>
            </Link>
            <Link to="/laporan">
              <Button variant="secondary">Rekap bulanan</Button>
            </Link>
          </>
        }
      />

      {showPicker && (
        <div className="mb-6 max-w-xs">
          <label htmlFor="ks-kelas" className="mb-1.5 block font-bold text-brand-900">
            Lihat kelas
          </label>
          <Select id="ks-kelas" value={classId} onChange={(e) => setPicked(Number(e.target.value))} className="h-12 text-lg font-semibold">
            {classes.data.map((c) => (
              <option key={c.id} value={c.id}>
                Kelas {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Siapa yang sedang mengajar sekarang */}
      <section className={cn('mb-8 border-l-4 p-4', live ? 'border-stabilo bg-brand-900 text-white' : 'border-slate-400 bg-white')}>
        {live ? (
          <>
            <p className="text-sm font-semibold text-brand-200">Sedang diajar</p>
            <p className="display text-[2.2rem] leading-none">{live.subjectName}</p>
            <p className="mt-1 text-brand-100">
              {live.teacherName}, sejak jam {live.startedAt.slice(11, 16)}
            </p>
          </>
        ) : (
          <>
            <p className="display text-[2.2rem] leading-none text-slate-800">Kelas kosong</p>
            <p className="mt-1 text-slate-600">Belum ada guru yang mengambil kelas ini sekarang.</p>
          </>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section className="min-w-0">
          <h2 className="display text-[1.9rem] text-brand-900">Kehadiran hari ini</h2>
          <p className="mb-3 text-slate-600">Dari pindaian pertama tiap siswa hari ini, oleh guru mana pun yang mengajar di kelas ini.</p>
          <Cells size="lg" cells={cells} />
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {STATUS_LIST.map((s) => (
              <li key={s} className="inline-flex items-center gap-2">
                <Mark status={s} size="sm" />
                <span className="font-bold text-slate-900">{counts[s]}</span>
                <span className="text-slate-600">{STATUS_META[s].label}</span>
              </li>
            ))}
            <li className="inline-flex items-center gap-2">
              <span className="size-5 rounded-sm bg-white ring-1 ring-slate-400 ring-inset" />
              <span className="font-bold text-slate-900">{notYet}</span>
              <span className="text-slate-600">Belum tercatat</span>
            </li>
          </ul>
        </section>

        <section className="min-w-0">
          <h2 className="display text-[1.9rem] text-brand-900">Pelajaran hari ini</h2>
          {sessions.data && sessions.data.length ? (
            <ul className="mt-2 border-t border-slate-300">
              {sessions.data.map((s) => (
                <li key={s.id} className="flex items-baseline gap-3 border-b border-slate-200 py-3">
                  <span className="display w-[7.2rem] shrink-0 text-lg leading-tight text-brand-900">
                    {s.startedAt.slice(11, 16)}
                    {s.endedAt ? `–${s.endedAt.slice(11, 16)}` : ' sampai sekarang'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-900">{s.subjectName}</span>
                    <span className="block truncate text-sm text-slate-600">{s.teacherName}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block font-bold text-emerald-700">{s.hadir} hadir</span>
                    {s.alpa > 0 && <span className="block font-semibold text-ink-red">{s.alpa} tidak hadir</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 border-t border-slate-300 pt-3 text-slate-600">Belum ada pelajaran di kelas ini hari ini.</p>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="display mb-3 text-[1.9rem] text-brand-900">Siapa hadir di tiap pelajaran</h2>
        {classId ? <LessonDayTable classId={classId} date={today} query="" /> : null}
      </section>
    </>
  )
}
