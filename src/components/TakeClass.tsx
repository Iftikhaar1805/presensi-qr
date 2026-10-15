'use client'

import { useEffect, useState } from 'react'
import { useUser } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import * as api from '../lib/api'
import type { TeachingSession } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { cn } from '../lib/utils'
import { Button, PageHeader, Select, Spinner } from './ui'

/**
 * Layar sebelum mengajar: guru memilih mata pelajarannya, lalu mengambil kelas yang sedang kosong.
 * Kelas yang sedang diajar guru lain tampil terkunci beserta nama gurunya, sampai guru itu keluar.
 */
export default function TakeClass({ onStarted }: { onStarted: (s: TeachingSession) => void }) {
  const user = useUser()
  const toast = useToast()
  const subjects = useLoad(api.getMySubjects, [])
  const classes = useLoad(api.getClassStatuses, [])
  const myClassId = useLoad(api.getClasses, []).data?.find((c) => c.homeroomTeacherId === user.teacherId)?.id
  const [subjectId, setSubjectId] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('scan-mapel')) || 0
    } catch {
      return 0
    }
  })
  const [busy, setBusy] = useState(0)
  const reloadClasses = classes.reload

  // Status kelas berubah saat guru lain mengambil atau keluar, jadi daftar diperbarui sendiri
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) void reloadClasses(true)
    }, 4000)
    return () => window.clearInterval(id)
  }, [reloadClasses])

  function chooseSubject(id: number) {
    setSubjectId(id)
    try {
      localStorage.setItem('scan-mapel', String(id))
    } catch {
      // abaikan
    }
  }

  const effectiveSubject = subjects.data?.some((x) => x.id === subjectId) ? subjectId : 0

  async function take(classId: number) {
    setBusy(classId)
    try {
      onStarted(await api.startSession(classId, effectiveSubject))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengambil kelas', 'error')
      void reloadClasses(true)
    } finally {
      setBusy(0)
    }
  }

  async function clear(sessionId: number, label: string) {
    setBusy(sessionId)
    try {
      await api.endSession(sessionId, false)
      toast(`${label} dikosongkan`)
      void reloadClasses(true)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengosongkan kelas', 'error')
    } finally {
      setBusy(0)
    }
  }

  return (
    <>
      <PageHeader title="Mengajar" subtitle="Pilih pelajaran Anda, lalu ambil kelas yang sedang kosong. Setelah itu Anda bisa memindai kartu siswa." />

      <div className="mb-8 max-w-sm">
        <label htmlFor="take-mapel" className="mb-1.5 block font-bold text-brand-900">
          Pelajaran yang Anda ajar
        </label>
        <Select id="take-mapel" value={effectiveSubject} onChange={(e) => chooseSubject(Number(e.target.value))} className="h-12 text-lg font-semibold">
          <option value={0}>Pilih pelajaran...</option>
          {subjects.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <h2 className="display mb-2 text-[1.9rem] text-brand-900">Pilih kelas</h2>
      {!classes.data ? (
        <Spinner />
      ) : (
        <ul className="border-t border-slate-300">
          {classes.data.map((c) => {
            const taken = c.active
            return (
              <li key={c.cls.id} className="flex items-center gap-4 border-b border-slate-300 py-4">
                <p className="display min-w-[4.6rem] shrink-0 text-[2.6rem] leading-none text-brand-900">{c.cls.name}</p>
                <div className="min-w-0 flex-1">
                  {taken ? (
                    <>
                      <p className="font-bold text-ink-red">Sedang diajar</p>
                      <p className="leading-snug text-slate-700">
                        {taken.teacherName}, {taken.subjectName}, sejak {taken.startedAt.slice(11, 16)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-emerald-700">Kosong</p>
                      <p className="text-sm leading-snug text-slate-600">
                        {c.cls.id === myClassId ? 'Kelas Anda sebagai wali. ' : ''}
                        {c.finishedToday ? `${c.finishedToday} pelajaran selesai hari ini` : 'Belum ada pelajaran hari ini'}
                      </p>
                    </>
                  )}
                </div>
                {taken ? (
                  user.role === 'admin' ? (
                    <Button variant="secondary" size="sm" loading={busy === taken.id} onClick={() => void clear(taken.id, `Kelas ${c.cls.name}`)}>
                      Kosongkan
                    </Button>
                  ) : (
                    <span className="shrink-0 rounded-sm bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Terkunci</span>
                  )
                ) : (
                  <Button size="md" className={cn('shrink-0')} loading={busy === c.cls.id} disabled={!effectiveSubject} onClick={() => void take(c.cls.id)}>
                    Ambil kelas
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!effectiveSubject && <p className="mt-3 font-semibold text-ink-red">Pilih pelajaran Anda dulu di bagian atas, baru tombol Ambil kelas aktif.</p>}
      <p className="mt-3 text-sm text-slate-500">Satu kelas hanya bisa diajar satu guru dalam satu waktu. Setelah pelajaran selesai, ketuk Akhiri pelajaran supaya kelas kembali kosong untuk guru berikutnya.</p>
    </>
  )
}
