'use client'

import { Check, Info, Printer, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from '../lib/nav'
import StudentCard from '../components/StudentCard'
import { Button, EmptyState, Input, PageHeader, Select, Spinner } from '../components/ui'
import * as api from '../lib/api'
import { useLoad } from '../lib/useLoad'
import { cn } from '../lib/utils'

/**
 * Cetak kartu QR. Bisa mencetak satu kartu (kartu hilang atau rusak), beberapa kartu pilihan, atau satu kelas penuh.
 * Hanya kartu yang dipilih yang ikut tercetak.
 */
export default function KartuQrPage() {
  const [params] = useSearchParams()
  const singleId = Number(params.get('siswa')) || 0

  const classes = useLoad(api.getClasses, [])
  const settings = useLoad(api.getSettings, [])
  const years = useLoad(api.getAcademicYears, [])
  const [classId, setClassId] = useState<number | null>(null) // null = belum dipilih, 0 = semua kelas
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const effectiveClass = singleId ? 0 : (classId ?? classes.data?.[0]?.id ?? 0)
  const loaded = useLoad(() => (effectiveClass || singleId ? api.getStudents(effectiveClass || undefined) : api.getStudents()), [effectiveClass, singleId])
  const year = years.data?.find((y) => y.isActive)?.name ?? ''

  const students = useMemo(() => {
    const all = loaded.data ?? []
    const q = query.trim().toLowerCase()
    return all.filter((s) => (singleId ? s.id === singleId : true) && (!q || s.name.toLowerCase().includes(q) || s.nis.includes(q)))
  }, [loaded.data, query, singleId])

  // Awalnya satu kelas terpilih semua. Dari Data Siswa (?siswa=), hanya satu kartu itu.
  useEffect(() => {
    if (!loaded.data) return
    setSelected(singleId ? new Set([singleId]) : new Set(loaded.data.map((s) => s.id)))
  }, [loaded.data, singleId])

  const visibleSelected = students.filter((s) => selected.has(s.id))

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const cls = classes.data?.find((c) => c.id === effectiveClass)
  const title = singleId && students[0] ? `Cetak kartu ${students[0].name}` : 'Cetak Kartu QR'

  return (
    <>
      <PageHeader
        title={title}
        subtitle="Cetak satu kartu kalau ada yang hilang, beberapa kartu pilihan, atau satu kelas penuh. Satu lembar A4 memuat 8 kartu."
        actions={
          <Button onClick={() => window.print()} disabled={!visibleSelected.length} icon={<Printer className="size-4" />}>
            Cetak {visibleSelected.length} kartu
          </Button>
        }
      />

      {singleId ? (
        <p className="no-print mb-5">
          <Link to="/kartu-qr" className="font-bold text-brand-600 underline underline-offset-4">
            Cetak kartu lain atau satu kelas
          </Link>
        </p>
      ) : (
        <div className="no-print mb-5 grid gap-3 sm:grid-cols-[14rem_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="kartu-kelas" className="mb-1.5 block font-bold text-brand-900">
              Kelas
            </label>
            <Select id="kartu-kelas" value={effectiveClass} onChange={(e) => setClassId(Number(e.target.value))} className="h-12 text-lg font-semibold">
              <option value={0}>Semua kelas</option>
              {classes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="kartu-cari" className="mb-1.5 block font-bold text-brand-900">
              Cari nama atau NIS
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
              <Input id="kartu-cari" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="contoh: Aditya" className="h-12 pl-10" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="h-12" onClick={() => setSelected(new Set([...selected, ...students.map((s) => s.id)]))}>
              Pilih semua
            </Button>
            <Button variant="secondary" className="h-12" onClick={() => setSelected(new Set([...selected].filter((id) => !students.some((s) => s.id === id))))}>
              Kosongkan
            </Button>
          </div>
        </div>
      )}

      <p className="no-print mb-4 flex items-start gap-2 text-sm text-slate-500">
        <Info className="mt-0.5 size-4 shrink-0" />
        Ketuk kartu untuk memilih atau membatalkan. Di jendela cetak, pilih kertas A4 dan nyalakan "Background graphics" supaya warna ikut tercetak. Pilih "Save as PDF" untuk menyimpan.
      </p>

      {loaded.loading && !loaded.data ? (
        <Spinner />
      ) : !students.length ? (
        <EmptyState title="Tidak ada siswa yang cocok">Ganti kelas atau kata pencarian.</EmptyState>
      ) : (
        <>
          <p className="no-print mb-3 font-semibold text-slate-700">
            {visibleSelected.length} dari {students.length} kartu dipilih{cls ? `, kelas ${cls.name}` : ''}
          </p>
          <div className="grid grid-cols-1 justify-items-center gap-5 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-[repeat(2,85.6mm)] print:justify-center print:gap-[4mm]">
            {students.map((s) => {
              const on = selected.has(s.id)
              return (
                <label key={s.id} className={cn('relative block w-full max-w-[340px] cursor-pointer print:max-w-none print:w-auto', !on && 'print:hidden')}>
                  <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(s.id)} aria-label={`Pilih kartu ${s.name}`} />
                  <span className={cn('block rounded-md transition-opacity peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand-500', on ? 'ring-4 ring-brand-600 ring-offset-2' : 'opacity-45')}>
                    <StudentCard student={s} className={s.className} schoolName={settings.data?.schoolName ?? ''} year={year} />
                  </span>
                  <span className={cn('no-print absolute -top-2 -right-2 grid size-8 place-items-center rounded-sm', on ? 'bg-brand-600 text-white' : 'bg-white text-transparent ring-2 ring-slate-300')}>
                    <Check className="size-5" strokeWidth={3} />
                  </span>
                </label>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
