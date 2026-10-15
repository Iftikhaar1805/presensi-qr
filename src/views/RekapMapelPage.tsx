'use client'

import { FileSpreadsheet, Printer } from 'lucide-react'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Button, Card, EmptyState, Mark, PageHeader, Select, Spinner } from '../components/ui'
import { useUser } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import * as api from '../lib/api'
import { useLoad } from '../lib/useLoad'
import { STATUS_META, addDays, cn, firstDayOfMonth, formatDateShort, parseDate, toDateStr } from '../lib/utils'

type Preset = 'bulan-ini' | 'bulan-lalu' | '7-hari'

function presetRange(p: Preset): [string, string] {
  const today = toDateStr()
  if (p === '7-hari') return [addDays(today, -6), today]
  if (p === 'bulan-lalu') {
    const lastOfPrev = addDays(firstDayOfMonth(today), -1)
    return [firstDayOfMonth(lastOfPrev), lastOfPrev]
  }
  return [firstDayOfMonth(today), today]
}

const longDate = (s: string) => parseDate(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Rekap satu mata pelajaran untuk satu kelas. Dipakai guru mapel untuk diserahkan ke wali kelas,
 * jadi bisa diunduh ke Excel atau dicetak.
 */
export default function RekapMapelPage() {
  const user = useUser()
  const toast = useToast()
  const classes = useLoad(api.getClasses, [])
  const subjects = useLoad(api.getSubjects, [])
  const settings = useLoad(api.getSettings, [])
  const [classIdState, setClassId] = useState(0)
  const [subjectIdState, setSubjectId] = useState(0)
  const [preset, setPreset] = useState<Preset>('bulan-ini')
  const [from, to] = presetRange(preset)

  const classId = classIdState || classes.data?.find((c) => c.homeroomTeacherId === user.teacherId)?.id || classes.data?.[0]?.id || 0
  const subjectId = subjectIdState || subjects.data?.[0]?.id || 0
  const cls = classes.data?.find((c) => c.id === classId)
  const subject = subjects.data?.find((s) => s.id === subjectId)
  const recap = useLoad(() => (classId && subjectId ? api.getLessonRecap(classId, subjectId, from, to) : Promise.resolve(null)), [classId, subjectId, from, to])
  const rows = recap.data?.rows ?? []
  const dates = recap.data?.dates ?? []
  const pct = (c: { hadir: number; izin: number; sakit: number; alpa: number }) => {
    const total = c.hadir + c.izin + c.sakit + c.alpa
    return total ? Math.round((c.hadir / total) * 100) : 0
  }

  function exportExcel() {
    if (!recap.data || !cls || !subject) return
    const head = [`Rekap Kehadiran ${subject.name}, Kelas ${cls.name}`, `${settings.data?.schoolName ?? ''}, periode ${longDate(from)} s.d. ${longDate(to)}`]
    const summary = [
      head,
      [],
      ['No', 'NIS', 'Nama', 'Hadir', 'Izin', 'Sakit', 'Alpa', '% Hadir'],
      ...rows.map((r, i) => [i + 1, r.student.nis, r.student.name, r.counts.hadir, r.counts.izin, r.counts.sakit, r.counts.alpa, pct(r.counts) / 100]),
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(summary)
    ws1['!cols'] = [{ wch: 4 }, { wch: 11 }, { wch: 28 }, { wch: 7 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 9 }]
    rows.forEach((_, i) => {
      const cell = ws1[XLSX.utils.encode_cell({ r: 3 + i, c: 7 })]
      if (cell) cell.z = '0%'
    })
    const perDate = [
      head,
      ['Keterangan: H = Hadir, I = Izin, S = Sakit, A = Alpa'],
      ['No', 'NIS', 'Nama', ...dates.map((d) => formatDateShort(d))],
      ...rows.map((r, i) => [i + 1, r.student.nis, r.student.name, ...dates.map((d) => (r.byDate[d] ? STATUS_META[r.byDate[d]!].short : ''))]),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(perDate)
    ws2['!cols'] = [{ wch: 4 }, { wch: 11 }, { wch: 28 }, ...dates.map(() => ({ wch: 6 }))]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan')
    XLSX.utils.book_append_sheet(wb, ws2, 'Per tanggal')
    XLSX.writeFile(wb, `Rekap-${subject.name.replace(/\s+/g, '-')}-${cls.name}-${from}-sd-${to}.xlsx`)
    toast('File Excel sudah diunduh')
  }

  return (
    <>
      <PageHeader
        title="Rekap per Pelajaran"
        subtitle="Rekap kehadiran satu mata pelajaran di satu kelas. Unduh atau cetak untuk diserahkan ke wali kelas."
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()} disabled={!rows.length} icon={<Printer className="size-4" />}>
              Cetak
            </Button>
            <Button onClick={exportExcel} disabled={!rows.length || !dates.length} icon={<FileSpreadsheet className="size-4" />}>
              Unduh Excel
            </Button>
          </>
        }
      />

      <div className="no-print mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[14rem_16rem_1fr]">
        <div>
          <label htmlFor="rm-kelas" className="mb-1.5 block font-bold text-brand-900">
            Kelas
          </label>
          <Select id="rm-kelas" value={classId} onChange={(e) => setClassId(Number(e.target.value))} className="h-12 text-lg font-semibold">
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                Kelas {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="rm-mapel" className="mb-1.5 block font-bold text-brand-900">
            Mata pelajaran
          </label>
          <Select id="rm-mapel" value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))} className="h-12 text-lg font-semibold">
            {subjects.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="mb-1.5 font-bold text-brand-900">Periode</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['bulan-ini', 'Bulan ini'],
                ['bulan-lalu', 'Bulan lalu'],
                ['7-hari', '7 hari'],
              ] as [Preset, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPreset(k)}
                className={cn('min-h-12 rounded-md px-3 font-semibold ring-1 transition-colors', preset === k ? 'bg-brand-900 text-white ring-brand-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="print-area">
        <div className="print-only mb-4 border-b-2 border-slate-800 pb-2 text-center">
          <p className="text-lg font-bold">{settings.data?.schoolName.toUpperCase()}</p>
          <p className="text-xs">{settings.data?.schoolAddress}</p>
        </div>
        <h2 className="display text-[1.9rem] text-brand-900">
          {subject?.name}, Kelas {cls?.name}
        </h2>
        <p className="mb-4 text-slate-600">
          {longDate(from)} s.d. {longDate(to)}, {dates.length} pertemuan tercatat
        </p>

        <Card className="overflow-hidden">
          {recap.loading && !recap.data ? (
            <Spinner />
          ) : !dates.length ? (
            <EmptyState title="Belum ada pertemuan tercatat">Pindai kartu siswa lewat menu Scan dengan memilih pelajaran ini, maka rekapnya muncul di sini.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-sm text-slate-600">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Nama siswa</th>
                    {dates.map((d) => (
                      <th key={d} className="px-1.5 py-3 text-center font-semibold whitespace-nowrap">
                        {parseDate(d).getDate()}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right font-semibold">% Hadir</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const p = pct(r.counts)
                    return (
                      <tr key={r.student.id} className="border-t border-slate-200">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold whitespace-nowrap text-slate-800">{r.student.name}</td>
                        {dates.map((d) => (
                          <td key={d} className="px-1.5 py-2 text-center">
                            {r.byDate[d] ? <Mark status={r.byDate[d]!} size="sm" /> : <span className="text-slate-300">–</span>}
                          </td>
                        ))}
                        <td className={cn('px-3 py-2 text-right font-extrabold', p >= 90 ? 'text-emerald-700' : p >= 75 ? 'text-orange-600' : 'text-ink-red')}>{p}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <p className="no-print mt-3 text-sm text-slate-500">H = hadir, I = izin, S = sakit, A = alpa. Angka di atas adalah tanggal pertemuan.</p>
      </div>
    </>
  )
}
