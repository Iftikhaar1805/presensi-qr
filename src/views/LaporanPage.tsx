'use client'

import { FileSpreadsheet, Printer, Users } from 'lucide-react'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import SchoolLogo from '../components/SchoolLogo'
import { Button, Card, EmptyState, Input, Mark, PageHeader, Select, Spinner } from '../components/ui'
import { useUser } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import * as api from '../lib/api'
import { useLoad } from '../lib/useLoad'
import { STATUS_LIST, STATUS_META, addDays, attendanceRate, cn, firstDayOfMonth, formatDateShort, parseDate, toDateStr } from '../lib/utils'

type Preset = 'bulan-ini' | 'bulan-lalu' | '7-hari' | 'pilih'
type View = 'ringkasan' | 'harian'

function presetRange(p: Preset): [string, string] {
  const today = toDateStr()
  if (p === '7-hari') return [addDays(today, -6), today]
  if (p === 'bulan-lalu') {
    const lastOfPrev = addDays(firstDayOfMonth(today), -1)
    return [firstDayOfMonth(lastOfPrev), lastOfPrev]
  }
  return [firstDayOfMonth(today), today]
}

function monthLabel(from: string, to: string): string {
  const f = parseDate(from).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const t = parseDate(to).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  return f === t ? f : `${f} s.d. ${t}`
}

export default function LaporanPage() {
  const user = useUser()
  const toast = useToast()
  const classes = useLoad(api.getClasses, [])
  const settings = useLoad(api.getSettings, [])
  const [classIdState, setClassId] = useState<number | null>(null)
  const [preset, setPreset] = useState<Preset>('bulan-ini')
  const [[from, to], setRange] = useState<[string, string]>(presetRange('bulan-ini'))
  const [view, setView] = useState<View>('ringkasan')

  const myClass = classes.data?.find((c) => c.homeroomTeacherId === user.teacherId)
  const classId = classIdState ?? myClass?.id ?? classes.data?.[0]?.id
  const cls = classes.data?.find((c) => c.id === classId)
  const recap = useLoad(() => (classId ? api.getRecap(classId, from, to) : Promise.resolve(null)), [classId, from, to])

  const total = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 }
  recap.data?.rows.forEach((r) => STATUS_LIST.forEach((s) => (total[s] += r.counts[s])))

  function choosePreset(p: Preset) {
    setPreset(p)
    if (p !== 'pilih') setRange(presetRange(p))
  }

  function exportExcel() {
    if (!recap.data || !cls) return
    const school = settings.data?.schoolName ?? 'Sekolah'
    const title = [`Rekap Kehadiran Siswa Kelas ${cls.name}`]
    const period = [`${school}, periode ${monthLabel(from, to)}`]

    const summary = [
      title,
      period,
      [],
      ['No', 'NIS', 'Nama', 'L/P', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa', '% Kehadiran'],
      ...recap.data.rows.map((r, i) => [
        i + 1,
        r.student.nis,
        r.student.name,
        r.student.gender,
        r.counts.hadir,
        r.counts.terlambat,
        r.counts.izin,
        r.counts.sakit,
        r.counts.alpa,
        attendanceRate(r.counts) / 100,
      ]),
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(summary)
    ws1['!cols'] = [{ wch: 4 }, { wch: 11 }, { wch: 28 }, { wch: 4 }, { wch: 7 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 12 }]
    for (let i = 0; i < recap.data.rows.length; i++) {
      const cell = ws1[XLSX.utils.encode_cell({ r: 4 + i, c: 9 })]
      if (cell) cell.z = '0%'
    }

    const daily = [
      title,
      period,
      ['Keterangan: H = Hadir, T = Terlambat, I = Izin, S = Sakit, A = Alpa'],
      ['No', 'NIS', 'Nama', ...recap.data.dates.map((d) => formatDateShort(d)), 'H', 'T', 'I', 'S', 'A'],
      ...recap.data.rows.map((r, i) => [
        i + 1,
        r.student.nis,
        r.student.name,
        ...recap.data!.dates.map((d) => (r.byDate[d] ? STATUS_META[r.byDate[d]!].short : '')),
        ...STATUS_LIST.map((s) => r.counts[s]),
      ]),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(daily)
    ws2['!cols'] = [{ wch: 4 }, { wch: 11 }, { wch: 28 }, ...recap.data.dates.map(() => ({ wch: 6 })), ...STATUS_LIST.map(() => ({ wch: 4 }))]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan')
    XLSX.utils.book_append_sheet(wb, ws2, 'Harian')
    XLSX.writeFile(wb, `Rekap-Kehadiran-${cls.name}-${from}-sd-${to}.xlsx`)
    toast('File Excel sudah diunduh')
  }

  return (
    <>
      <PageHeader
        title="Rekap & Export"
        subtitle="Rekap kehadiran per kelas untuk laporan bulanan atau rapor."
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()} disabled={!recap.data?.rows.length} icon={<Printer className="size-4" />}>
              Cetak / PDF
            </Button>
            <Button onClick={exportExcel} disabled={!recap.data?.rows.length} icon={<FileSpreadsheet className="size-4" />}>
              Unduh Excel
            </Button>
          </>
        }
      />

      <div className="no-print mb-4">
        <div className="grid gap-3 md:grid-cols-[200px_1fr]">
          <Select id="laporan-kelas" value={classId ?? ''} onChange={(e) => setClassId(Number(e.target.value))} className="h-11">
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                Kelas {c.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {(
              [
                ['bulan-ini', 'Bulan ini'],
                ['bulan-lalu', 'Bulan lalu'],
                ['7-hari', '7 hari terakhir'],
                ['pilih', 'Pilih tanggal'],
              ] as [Preset, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => choosePreset(k)}
                className={cn(
                  'min-h-11 rounded-md px-4 font-semibold ring-1 transition-colors',
                  preset === k ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {preset === 'pilih' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Input id="dari" type="date" value={from} max={to} onChange={(e) => e.target.value && setRange([e.target.value, to])} className="h-11 w-auto" />
            sampai
            <Input id="sampai" type="date" value={to} min={from} max={toDateStr()} onChange={(e) => e.target.value && setRange([from, e.target.value])} className="h-11 w-auto" />
          </div>
        )}
      </div>

      <div className="print-area">
        {/* Kop laporan — muncul saat dicetak */}
        <div className="print-only mb-4 flex items-center gap-3 border-b-2 border-slate-800 pb-2">
          <SchoolLogo className="size-14 object-contain" />
          <div className="flex-1 text-center">
            <p className="text-lg font-bold">{settings.data?.schoolName.toUpperCase()}</p>
            <p className="text-xs">{settings.data?.schoolAddress}</p>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Rekap Kehadiran Kelas {cls?.name}</h2>
            <p className="text-sm text-slate-500">
              {monthLabel(from, to)}, {recap.data?.dates.length ?? 0} hari sekolah
            </p>
          </div>
          <div className="no-print flex rounded-md bg-slate-100 p-1">
            {(
              [
                ['ringkasan', 'Ringkasan'],
                ['harian', 'Tabel harian'],
              ] as [View, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className={cn('min-h-11 rounded-lg px-4 text-sm font-semibold', view === k ? 'bg-white text-slate-900' : 'text-slate-500')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-5 divide-x divide-slate-300 border-y-2 border-slate-900 bg-white">
          {STATUS_LIST.map((s) => (
            <div key={s} className="flex flex-col items-center gap-1 px-1 py-2.5">
              <span className="flex items-center gap-1.5">
                <Mark status={s} size="sm" />
                <span className={cn('hidden text-sm font-semibold sm:inline', STATUS_META[s].text)}>{STATUS_META[s].label}</span>
              </span>
              <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{total[s]}</span>
            </div>
          ))}
        </div>

        <Card className="overflow-hidden">
          {recap.loading ? (
            <Spinner />
          ) : !recap.data?.rows.length ? (
            <EmptyState icon={<Users className="size-6" />} title="Belum ada data">
              Belum ada siswa di kelas ini atau belum ada hari sekolah pada periode tersebut.
            </EmptyState>
          ) : view === 'ringkasan' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">No</th>
                    <th className="px-2 py-3 font-semibold sm:px-4">Nama siswa</th>
                    {STATUS_LIST.map((s) => (
                      <th key={s} className="px-0.5 py-3 text-center font-semibold sm:px-2" title={STATUS_META[s].label}>
                        <Mark status={s} size="sm" />
                      </th>
                    ))}
                    <th className="px-2 py-3 text-right font-semibold sm:px-4">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recap.data.rows.map((r, i) => {
                    const rate = attendanceRate(r.counts)
                    return (
                      <tr key={r.student.id} className="avoid-break">
                        <td className="hidden px-4 py-2.5 text-slate-400 tabular-nums sm:table-cell">{i + 1}</td>
                        <td className="px-2 py-2.5 sm:px-4">
                          <p className="font-semibold text-slate-800">{r.student.name}</p>
                          <p className="text-xs text-slate-500">{r.student.nis}</p>
                        </td>
                        {STATUS_LIST.map((s) => (
                          <td key={s} className={cn('px-0.5 py-2.5 text-center sm:px-2', r.counts[s] ? 'font-bold text-slate-900' : 'text-slate-300')}>
                            {r.counts[s] || '–'}
                          </td>
                        ))}
                        <td className="px-2 py-2.5 text-right sm:px-4">
                          <span className={cn('font-bold tabular-nums', rate >= 90 ? 'text-emerald-600' : rate >= 75 ? 'text-amber-600' : 'text-rose-600')}>{rate}%</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 text-left font-semibold">Nama siswa</th>
                    {recap.data.dates.map((d) => (
                      <th key={d} className="min-w-8 px-1 py-2.5 text-center font-semibold whitespace-nowrap">
                        {parseDate(d).getDate()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recap.data.rows.map((r) => (
                    <tr key={r.student.id}>
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-semibold whitespace-nowrap text-slate-800">{r.student.name}</td>
                      {recap.data!.dates.map((d) => {
                        const st = r.byDate[d]
                        return (
                          <td key={d} className="px-0.5 py-1 text-center">
                            {st ? (
                              <span className={cn('inline-grid size-6 place-items-center rounded-md font-bold', st === 'hadir' ? 'text-emerald-600' : STATUS_META[st].badge)}>
                                {STATUS_META[st].short}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <p className="no-print mt-3 text-xs text-slate-500">
          Persentase kehadiran = (Hadir + Terlambat) dibagi jumlah hari sekolah. Hijau 90% ke atas, kuning 75–89%, merah di bawah 75%.
        </p>
      </div>
    </>
  )
}
