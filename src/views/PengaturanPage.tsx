'use client'

import { CalendarPlus, CheckCircle2, DatabaseBackup, DatabaseZap, Eraser, ImagePlus, Play, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button, ConfirmModal, Field, Input, Spinner, PageHeader } from '../components/ui'
import { useNavigate } from '../lib/nav'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import { useToast } from '../context/ToastContext'
import { fileToLogoDataUrl } from '../lib/image'
import * as api from '../lib/api'
import type { Settings } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { cn, formatDateLong, minutesOf, toDateStr } from '../lib/utils'

function Section({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-slate-200 py-8 first:pt-0 last:border-0 lg:grid-cols-[260px_1fr]">
      <div>
        <h2 className="font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function addMinutes(time: string, m: number): string {
  const t = minutesOf(time) + m
  return `${String(Math.floor(t / 60)).padStart(2, '0')}.${String(t % 60).padStart(2, '0')}`
}

export default function PengaturanPage() {
  const toast = useToast()
  const school = useSchool()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const restoreRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ data: unknown; students: number; exportedAt: string } | null>(null)
  const [restoring, setRestoring] = useState(false)
  const audit = useLoad(() => api.getAudit(40), [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const loaded = useLoad(api.getSettings, [])
  const years = useLoad(api.getAcademicYears, [])
  const holidays = useLoad(api.getHolidays, [])
  const [s, setS] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [newYear, setNewYear] = useState('')
  const [hDate, setHDate] = useState(toDateStr())
  const [hDesc, setHDesc] = useState('')
  const [confirm, setConfirm] = useState<'today' | 'all' | null>(null)
  const [busy, setBusy] = useState(false)
  const [preparing, setPreparing] = useState(false)

  useEffect(() => {
    if (loaded.data) setS(loaded.data)
  }, [loaded.data])

  if (!s) return <Spinner />

  async function saveSettings(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.saveSettings(s!)
      await school.reload()
      toast('Pengaturan disimpan')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function addYear(e: FormEvent) {
    e.preventDefault()
    try {
      await api.addAcademicYear(newYear.trim())
      setNewYear('')
      toast('Tahun ajaran ditambahkan')
      void years.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal', 'error')
    }
  }

  async function addHoliday(e: FormEvent) {
    e.preventDefault()
    if (!hDesc.trim()) return toast('Isi keterangan hari libur', 'error')
    try {
      await api.addHoliday(hDate, hDesc.trim())
      setHDesc('')
      toast('Hari libur ditambahkan')
      void holidays.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal', 'error')
    }
  }

  async function downloadBackup() {
    const json = await api.exportBackup()
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-presensi-${toDateStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function pickBackup(file: File) {
    try {
      const data = JSON.parse(await file.text()) as { version?: number; students?: unknown[]; exportedAt?: string }
      if (data.version !== 2 || !Array.isArray(data.students)) throw new Error('format')
      setPending({ data, students: data.students.length, exportedAt: data.exportedAt ?? '' })
    } catch {
      toast('Berkas ini bukan cadangan dari aplikasi ini, atau cadangan lama yang tidak bisa dipulihkan.', 'error')
    }
  }

  async function runRestore() {
    if (!pending) return
    setRestoring(true)
    try {
      await api.restoreBackup(pending.data)
      toast('Data dipulihkan. Silakan masuk lagi.')
      logout()
      navigate('/login', { replace: true })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Pemulihan gagal', 'error')
      setRestoring(false)
      setPending(null)
    }
  }

  async function prepareDemo() {
    setPreparing(true)
    try {
      const now = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      await api.saveSettings({ ...s!, checkInTime: now, lateTolerance: 120, cutoffTime: '23:59' })
      await api.resetToday()
      toast(`Siap. Jam masuk ${now}, scan sampai 2 jam ke depan dicatat Hadir.`)
      void loaded.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyiapkan latihan', 'error')
    } finally {
      setPreparing(false)
    }
  }

  async function runReset() {
    setBusy(true)
    if (confirm === 'today') {
      const n = await api.resetToday()
      toast(`${n} data presensi hari ini dihapus`)
    } else {
      await api.resetDemo()
      toast('Semua data dikembalikan ke data contoh')
      setTimeout(() => window.location.reload(), 600)
    }
    setBusy(false)
    setConfirm(null)
  }

  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Atur jam sekolah, tahun ajaran, dan hari libur." />

      <div>
        <Section title="Logo sekolah" desc="Tampil di pojok aplikasi, kartu siswa, dan kop laporan. Gambar dikecilkan otomatis.">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid size-24 shrink-0 place-items-center rounded-md bg-slate-50 ring-1 ring-slate-200">
              {school.logo ? <img src={school.logo} alt="Logo sekolah saat ini" className="size-20 object-contain" /> : <span className="px-2 text-center text-sm text-slate-400">Belum ada logo</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label="Pilih berkas logo"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  setLogoBusy(true)
                  try {
                    await api.setSchoolLogo(await fileToLogoDataUrl(file))
                    await school.reload()
                    toast('Logo sekolah tersimpan')
                  } catch (err) {
                    toast(err instanceof Error ? err.message : 'Logo gagal disimpan', 'error')
                  } finally {
                    setLogoBusy(false)
                  }
                }}
              />
              <Button variant="secondary" loading={logoBusy} onClick={() => fileRef.current?.click()} icon={<ImagePlus className="size-4" />}>
                {school.logo ? 'Ganti logo' : 'Pilih logo'}
              </Button>
              {school.logo && (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await api.setSchoolLogo(null)
                    await school.reload()
                    toast('Logo dihapus')
                  }}
                >
                  Hapus logo
                </Button>
              )}
            </div>
          </div>
        </Section>

        <Section title="Jam presensi" desc="Menentukan siswa dihitung tepat waktu, terlambat, atau alpa.">
          <form onSubmit={saveSettings} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Jam masuk">
                <Input id="jam-masuk" type="time" value={s.checkInTime} onChange={(e) => setS({ ...s, checkInTime: e.target.value })} />
              </Field>
              <Field label="Toleransi (menit)">
                <Input id="toleransi" type="number" min={0} max={120} value={s.lateTolerance} onChange={(e) => setS({ ...s, lateTolerance: Number(e.target.value) })} />
              </Field>
              <Field label="Batas presensi">
                <Input id="jam-batas" type="time" value={s.cutoffTime} onChange={(e) => setS({ ...s, cutoffTime: e.target.value })} />
              </Field>
            </div>
            {/* Penjelasan dalam bahasa sehari-hari */}
            <div className="grid gap-2 rounded-md bg-slate-50 p-4 text-sm sm:grid-cols-3">
              <p>
                <span className="font-semibold text-emerald-700">Tepat waktu</span>
                <br />
                scan sampai jam {addMinutes(s.checkInTime, s.lateTolerance)}
              </p>
              <p>
                <span className="font-semibold text-amber-700">Terlambat</span>
                <br />
                scan setelah jam {addMinutes(s.checkInTime, s.lateTolerance)}
              </p>
              <p>
                <span className="font-semibold text-rose-700">Alpa otomatis</span>
                <br />
                belum scan sampai jam {s.cutoffTime.replace(':', '.')}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nama sekolah">
                <Input id="nama-sekolah" value={s.schoolName} onChange={(e) => setS({ ...s, schoolName: e.target.value })} />
              </Field>
              <Field label="Alamat (untuk kop laporan)">
                <Input id="alamat" value={s.schoolAddress} onChange={(e) => setS({ ...s, schoolAddress: e.target.value })} />
              </Field>
            </div>
            <Button type="submit" loading={saving} icon={<Save className="size-4" />}>
              Simpan pengaturan
            </Button>
          </form>
        </Section>

        <Section title="Tahun ajaran" desc="Hanya kelas dari tahun ajaran aktif yang tampil di aplikasi.">
          <ul className="mb-3 divide-y divide-slate-100 rounded-md ring-1 ring-slate-200">
            {years.data?.map((y) => (
              <li key={y.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-semibold text-slate-800">{y.name}</span>
                {y.isActive ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                    <CheckCircle2 className="size-4" /> Aktif
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await api.activateAcademicYear(y.id)
                      toast(`Tahun ajaran ${y.name} diaktifkan`)
                      void years.reload()
                    }}
                  >
                    Jadikan aktif
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={addYear} className="flex gap-2">
            <Input id="tahun-baru" value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="2026/2027" className="max-w-40" />
            <Button type="submit" variant="secondary" disabled={!newYear.trim()}>
              Tambah
            </Button>
          </form>
        </Section>

        <Section title="Hari libur" desc="Pada hari libur presensi ditutup dan siswa tidak dihitung alpa. Hari Minggu otomatis libur.">
          <form onSubmit={addHoliday} className="mb-3 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
            <Input id="libur-tanggal" type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} />
            <Input id="libur-ket" value={hDesc} onChange={(e) => setHDesc(e.target.value)} placeholder="contoh: Maulid Nabi" />
            <Button type="submit" variant="secondary" icon={<CalendarPlus className="size-4" />}>
              Tambah
            </Button>
          </form>
          {holidays.data?.length ? (
            <ul className="divide-y divide-slate-100 rounded-md ring-1 ring-slate-200">
              {holidays.data.map((h) => (
                <li key={h.id} className={cn('flex items-center gap-3 px-4 py-3', h.date < toDateStr() && 'opacity-60')}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{h.description}</p>
                    <p className="text-sm text-slate-500">{formatDateLong(h.date)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-ink-red hover:bg-rose-50"
                    title="Hapus"
                    onClick={async () => {
                      await api.deleteHoliday(h.id)
                      void holidays.reload()
                    }}
                    icon={<Trash2 className="size-4" />}
                 >
                    Hapus
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Belum ada hari libur yang dicatat.</p>
          )}
        </Section>

        <Section title="Data & latihan" desc="Untuk sesi pelatihan PKM dan cadangan data.">
          <button
            onClick={() => void prepareDemo()}
            disabled={preparing}
            className="mb-4 flex w-full items-center gap-4 rounded-md bg-stabilo p-4 text-left text-brand-900 hover:brightness-95 disabled:opacity-60"
          >
            <Play className="size-7 shrink-0" strokeWidth={2.25} />
            <span>
              <span className="display block text-2xl">Siapkan latihan sekarang</span>
              <span className="block text-sm font-semibold">Jam masuk jadi sekarang, batas presensi sampai malam, dan absen hari ini dikosongkan. Semua scan langsung tercatat Hadir.</span>
            </span>
          </button>
          <input
            ref={restoreRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Pilih berkas cadangan"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void pickBackup(f)
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button onClick={() => setConfirm('today')} className="rounded-md p-4 text-left ring-1 ring-slate-200 hover:bg-slate-50">
              <Eraser className="size-5 text-slate-500" />
              <p className="mt-2 font-semibold text-slate-800">Ulangi latihan scan</p>
              <p className="text-sm text-slate-500">Hapus presensi hari ini saja</p>
            </button>
            <button onClick={() => void downloadBackup()} className="rounded-md p-4 text-left ring-1 ring-slate-200 hover:bg-slate-50">
              <DatabaseBackup className="size-5 text-slate-500" />
              <p className="mt-2 font-semibold text-slate-800">Unduh cadangan</p>
              <p className="text-sm text-slate-500">Simpan semua data ke file</p>
            </button>
            <button onClick={() => restoreRef.current?.click()} className="rounded-md p-4 text-left ring-1 ring-slate-200 hover:bg-slate-50">
              <DatabaseZap className="size-5 text-slate-500" />
              <p className="mt-2 font-semibold text-slate-800">Pulihkan cadangan</p>
              <p className="text-sm text-slate-500">Kembalikan dari file cadangan</p>
            </button>
            <button onClick={() => setConfirm('all')} className="rounded-md p-4 text-left ring-1 ring-rose-200 hover:bg-rose-50">
              <RotateCcw className="size-5 text-rose-500" />
              <p className="mt-2 font-semibold text-rose-700">Kembalikan data contoh</p>
              <p className="text-sm text-slate-500">Semua perubahan dihapus</p>
            </button>
          </div>
        </Section>

        <Section title="Riwayat perubahan" desc="Siapa mengubah apa dan kapan: absen pelajaran, kartu QR, pengaturan, dan pemulihan data.">
          {audit.loading && !audit.data ? (
            <Spinner />
          ) : !audit.data?.length ? (
            <p className="text-slate-500">Belum ada perubahan tercatat.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-md ring-1 ring-slate-200">
              {audit.data.map((r) => (
                <li key={r.id} className="px-4 py-2.5">
                  <p className="font-semibold text-slate-900">{r.action}</p>
                  {r.detail && <p className="text-slate-600">{r.detail}</p>}
                  <p className="text-sm text-slate-500">
                    {r.userName}, {r.at.slice(0, 16)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <ConfirmModal
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => void runRestore()}
        loading={restoring}
        title="Pulihkan dari cadangan?"
        message={`Semua data sekarang diganti dengan isi berkas ini (${pending?.students ?? 0} siswa${pending?.exportedAt ? `, dibuat ${pending.exportedAt.slice(0, 10)}` : ''}), termasuk akun dan password. Anda akan diminta masuk lagi. Jika berkasnya rusak, data sekarang tidak berubah.`}
        confirmLabel="Pulihkan"
      />

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runReset}
        loading={busy}
        title={confirm === 'today' ? 'Hapus presensi hari ini?' : 'Kembalikan semua data contoh?'}
        message={
          confirm === 'today'
            ? 'Semua scan hari ini dihapus sehingga peserta bisa latihan scan dari awal. Data hari lain tidak berubah.'
            : 'Semua siswa, guru, kelas, dan presensi yang sudah diubah akan diganti dengan data contoh awal.'
        }
        confirmLabel={confirm === 'today' ? 'Hapus presensi hari ini' : 'Kembalikan data contoh'}
      />
    </>
  )
}
