'use client'

import { CalendarOff, ChevronLeft, ChevronRight, History, Lock, Pencil, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from '../lib/nav'
import LessonDayTable from '../components/LessonDayTable'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge } from '../components/ui'
import { useUser } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import * as api from '../lib/api'
import type { AttendanceLog, DailyRow, Status } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { STATUS_LIST, STATUS_META, addDays, cn, formatDateLong, toDateStr } from '../lib/utils'

type Filter = 'semua' | 'belum' | Status

function EditStatusModal({ row, date, onClose, onSaved }: { row: DailyRow | null; date: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [status, setStatus] = useState<Status>('izin')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [logs, setLogs] = useState<AttendanceLog[]>([])

  useEffect(() => {
    if (!row) return
    const current = row.attendance?.status
    setStatus(current && current !== 'alpa' ? current : 'izin')
    setNote(row.attendance?.note.startsWith('Otomatis') ? '' : (row.attendance?.note ?? ''))
    setLogs([])
    if (row.attendance) api.getLogs(row.attendance.id).then(setLogs)
  }, [row])

  if (!row) return null
  const canEdit = row.canEdit

  async function save() {
    setSaving(true)
    try {
      await api.setStatus(row!.student.id, date, status, note.trim())
      toast(`Status ${row!.student.name} disimpan: ${STATUS_META[status].label}`)
      onSaved()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Ubah status kehadiran"
      footer={
        canEdit ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button onClick={save} loading={saving}>
              Simpan status
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        )
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <div>
          <p className="font-semibold text-slate-900">{row.student.name}</p>
          <p className="text-sm text-slate-500">
            NIS {row.student.nis}, kelas {row.student.className}
          </p>
        </div>
      </div>

      {!canEdit ? (
        <div className="flex gap-3 rounded-md bg-amber-50 p-3.5 text-sm text-amber-800">
          <Lock className="mt-0.5 size-4 shrink-0" />
          Hanya wali kelas {row.student.className} atau admin yang bisa mengubah status siswa ini.
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Pilih status</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STATUS_LIST.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-3 text-left font-semibold ring-1 transition-colors',
                    status === s ? `${STATUS_META[s].soft} ring-2 ring-current` : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  <span className={cn('size-2.5 rounded-full', STATUS_META[s].dot)} />
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Keterangan (boleh dikosongkan)" hint="Contoh: surat dokter, acara keluarga">
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tulis keterangan singkat" />
          </Field>
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <History className="size-4 text-slate-400" /> Riwayat perubahan
          </p>
          <ul className="space-y-2 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                <span className="font-semibold text-slate-800">{l.changedByName}</span> mengubah{' '}
                {l.oldStatus ? STATUS_META[l.oldStatus].label : 'kosong'} menjadi <span className="font-semibold">{STATUS_META[l.newStatus].label}</span>
                {l.note && <> ({l.note})</>}
                <span className="block text-xs text-slate-400">{l.at.slice(0, 16)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}

export default function RekapHarianPage() {
  const user = useUser()
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(params.get('tanggal') ?? toDateStr())
  const [filter, setFilter] = useState<Filter>('semua')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'harian' | 'pelajaran'>('harian')
  const [editing, setEditing] = useState<DailyRow | null>(null)

  const classes = useLoad(api.getClasses, [])
  const myClass = classes.data?.find((c) => c.homeroomTeacherId === user.teacherId)
  const fromUrl = Number(params.get('kelas'))
  const classId = classes.data?.some((c) => c.id === fromUrl) ? fromUrl : (myClass?.id ?? classes.data?.[0]?.id)
  const rows = useLoad(() => (classId ? api.getDaily(date, classId) : Promise.resolve([])), [date, classId])
  const day = useLoad(() => api.checkSchoolDay(date), [date])

  const today = toDateStr()
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { semua: 0, belum: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 }
    for (const r of rows.data ?? []) {
      c.semua++
      c[r.attendance?.status ?? 'belum']++
    }
    return c
  }, [rows.data])

  const visible = (rows.data ?? []).filter((r) => {
    if (filter !== 'semua' && (r.attendance?.status ?? 'belum') !== filter) return false
    const q = query.trim().toLowerCase()
    return !q || r.student.name.toLowerCase().includes(q) || r.student.nis.includes(q)
  })

  const filters: { key: Filter; label: string; dot?: string }[] = [
    { key: 'semua', label: 'Semua' },
    ...(counts.belum ? [{ key: 'belum' as Filter, label: 'Belum datang', dot: 'bg-slate-300' }] : []),
    ...STATUS_LIST.map((s) => ({ key: s as Filter, label: STATUS_META[s].label, dot: STATUS_META[s].dot })),
  ]

  return (
    <>
      <PageHeader title="Rekap Harian" subtitle="Status harian per kelas, atau tabel per pelajaran untuk melihat siapa yang bolos." />

      <div className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" className="h-11 px-2.5" onClick={() => setDate(addDays(date, -1))} aria-label="Hari sebelumnya">
              <ChevronLeft className="size-5" />
            </Button>
            <Input id="tanggal" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-11 w-auto" />
            <Button variant="secondary" size="sm" className="h-11 px-2.5" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} aria-label="Hari berikutnya">
              <ChevronRight className="size-5" />
            </Button>
          </div>
          <div className="grid grid-cols-[1.25fr_1fr] gap-3 sm:grid-cols-[12rem_1fr]">
          <Select
            id="kelas"
            value={classId ?? ''}
            onChange={(e) => {
              params.set('kelas', e.target.value)
              setParams(params, { replace: true })
            }}
            className="h-11"
          >
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                Kelas {c.name}
                {c.id === myClass?.id ? ' (saya)' : ''}
              </option>
            ))}
          </Select>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
            <Input id="cari" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama" className="h-11 pl-10" />
          </div>
          </div>
        </div>
        <p className="mt-3 text-sm font-medium text-slate-600">{formatDateLong(date)}</p>
      </div>

      <div className="mb-5 flex w-fit rounded-md bg-slate-200 p-1" role="tablist">
        {(
          [
            ['harian', 'Status harian'],
            ['pelajaran', 'Per pelajaran'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={view === k}
            onClick={() => setView(k)}
            className={cn('min-h-10 rounded-sm px-4 font-bold', view === k ? 'bg-brand-900 text-white' : 'text-slate-700 hover:bg-slate-300/60')}
          >
            {label}
          </button>
        ))}
      </div>

      {day.data && !day.data.open ? (
        <Card>
          <EmptyState icon={<CalendarOff className="size-6" />} title="Tidak ada presensi">
            {day.data.reason}. Sekolah libur pada tanggal ini.
          </EmptyState>
        </Card>
      ) : view === 'pelajaran' && classId ? (
        <LessonDayTable classId={classId} date={date} query={query} />
      ) : (
        <>
          <div className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3.5 font-semibold ring-1 transition-colors',
                  filter === f.key ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100',
                )}
              >
                {f.dot && <span className={cn('size-2 rounded-full', f.dot)} />}
                {f.label}
                <span className={cn('tabular-nums', filter === f.key ? 'text-slate-300' : 'text-slate-400')}>{counts[f.key]}</span>
              </button>
            ))}
          </div>

          <Card>
            {classes.loading || !classId || (rows.loading && !rows.data) ? (
              <Spinner />
            ) : visible.length ? (
              <ul className="divide-y divide-slate-100">
                {visible.map((r, i) => (
                  <li key={r.student.id}>
                    <button onClick={() => setEditing(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:px-5">
                      <span className="w-6 shrink-0 text-right text-sm text-slate-400 tabular-nums">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-800">{r.student.name}</p>
                        <p className="truncate text-sm text-slate-500">
                          NIS {r.student.nis}
                          {r.attendance?.note && !r.attendance.note.startsWith('Otomatis') && <>, {r.attendance.note}</>}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={r.attendance?.status ?? null} />
                        <span className="text-xs text-slate-500 tabular-nums">{r.attendance?.checkInTime ? `jam ${r.attendance.checkInTime.slice(0, 5)}` : ' '}</span>
                      </div>
                      <Pencil className="hidden size-4 shrink-0 text-slate-300 sm:block" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Users className="size-6" />} title="Tidak ada siswa yang cocok">
                Coba ganti filter status atau kata pencarian.
              </EmptyState>
            )}
          </Card>
        </>
      )}

      <EditStatusModal row={editing} date={date} onClose={() => setEditing(null)} onSaved={() => void rows.reload()} />
    </>
  )
}
