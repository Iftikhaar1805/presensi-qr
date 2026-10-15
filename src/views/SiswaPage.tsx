'use client'

import { Download, FileUp, IdCard, Printer, Pencil, Plus, RefreshCcw, Search, Trash2, Upload, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from '../lib/nav'
import * as XLSX from 'xlsx'
import StudentCard from '../components/StudentCard'
import { Button, Card, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner } from '../components/ui'
import { useUser } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import * as api from '../lib/api'
import type { SchoolClass, Student } from '../lib/types'
import { useLoad } from '../lib/useLoad'

type Draft = { id?: number; nis: string; name: string; gender: 'L' | 'P'; classId: number }

function StudentForm({ draft, classes, onClose, onSaved }: { draft: Draft; classes: SchoolClass[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [d, setD] = useState(draft)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.saveStudent(d)
      toast(d.id ? 'Data siswa diperbarui' : 'Siswa ditambahkan. Kartu QR-nya sudah bisa dicetak.')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={d.id ? 'Ubah data siswa' : 'Tambah siswa'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="student-form" loading={saving}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={submit} className="space-y-4">
        <Field label="NIS" hint="Dipakai siswa untuk login dan untuk absen manual">
          <Input id="s-nis" inputMode="numeric" value={d.nis} onChange={(e) => setD({ ...d, nis: e.target.value })} required />
        </Field>
        <Field label="Nama lengkap">
          <Input id="s-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jenis kelamin">
            <Select id="s-gender" value={d.gender} onChange={(e) => setD({ ...d, gender: e.target.value as 'L' | 'P' })}>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </Select>
          </Field>
          <Field label="Kelas">
            <Select id="s-class" value={d.classId} onChange={(e) => setD({ ...d, classId: Number(e.target.value) })}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {error && <p className="rounded-md bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">{error}</p>}
      </form>
    </Modal>
  )
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [rows, setRows] = useState<api.ImportRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.importStudents>> | null>(null)
  const [loading, setLoading] = useState(false)

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['NIS', 'Nama', 'L/P', 'Kelas'],
      ['20259001', 'Contoh Nama Siswa', 'L', '7A'],
      ['20259002', 'Contoh Nama Siswi', 'P', '7B'],
    ])
    ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 5 }, { wch: 7 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Siswa')
    XLSX.writeFile(wb, 'Template-Import-Siswa.xlsx')
  }

  async function readFile(file: File) {
    setFileName(file.name)
    setResult(null)
    const wb = XLSX.read(await file.arrayBuffer())
    const sheet = wb.Sheets[wb.SheetNames[0]!]!
    const data = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, blankrows: false }).slice(1)
    setRows(data.map((r) => ({ nis: String(r[0] ?? ''), name: String(r[1] ?? ''), gender: String(r[2] ?? ''), className: String(r[3] ?? '') })))
  }

  async function runImport() {
    if (!rows) return
    setLoading(true)
    const r = await api.importStudents(rows)
    setResult(r)
    setLoading(false)
    if (r.added) {
      toast(`${r.added} siswa berhasil diimpor`)
      onDone()
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Import siswa dari Excel"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {result ? 'Selesai' : 'Batal'}
          </Button>
          {!result && (
            <Button onClick={runImport} disabled={!rows?.length} loading={loading} icon={<Upload className="size-4" />}>
              Import {rows?.length ?? 0} siswa
            </Button>
          )}
        </>
      }
    >
      <ol className="space-y-4">
        <li className="flex gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-brand-100 text-sm font-bold text-brand-700">1</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Unduh template, lalu isi data siswa</p>
            <p className="text-sm text-slate-500">Kolom: NIS, Nama, L/P, Kelas (contoh: 7A). Jangan ubah baris judul.</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={downloadTemplate} icon={<Download className="size-4" />}>
              Unduh template Excel
            </Button>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-brand-100 text-sm font-bold text-brand-700">2</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Pilih file yang sudah diisi</p>
            <label className="mt-2 flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-slate-300 px-4 py-6 text-center hover:border-brand-400 hover:bg-brand-50/40">
              <FileUp className="size-7 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">{fileName || 'Ketuk untuk memilih file .xlsx atau .csv'}</span>
              {rows && <span className="text-xs text-slate-500">{rows.length} baris data terbaca</span>}
              <input id="import-file" type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
            </label>
          </div>
        </li>
      </ol>

      {rows && !result && rows.length > 0 && (
        <div className="mt-4 max-h-48 overflow-auto rounded-md ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">NIS</th>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">L/P</th>
                <th className="px-3 py-2">Kelas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 50).map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 tabular-nums">{r.nis}</td>
                  <td className="px-3 py-1.5">{r.name}</td>
                  <td className="px-3 py-1.5">{r.gender}</td>
                  <td className="px-3 py-1.5">{r.className}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-2">
          <p className="rounded-md bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-700">{result.added} siswa berhasil ditambahkan.</p>
          {result.errors.length > 0 && (
            <div className="rounded-md bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              <p className="font-semibold">{result.errors.length} baris dilewati. Perbaiki di Excel lalu import ulang baris tersebut:</p>
              <ul className="mt-1 list-disc pl-5">
                {result.errors.slice(0, 10).map((e) => (
                  <li key={e.row}>
                    Baris {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function CardModal({ student, canRegenerate, onClose, onChanged }: { student: Student; canRegenerate: boolean; onClose: () => void; onChanged: (s: Student) => void }) {
  const toast = useToast()
  const settings = useLoad(api.getSettings, [])
  const years = useLoad(api.getAcademicYears, [])
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  async function regenerate() {
    setBusy(true)
    const s = await api.regenerateQr(student.id)
    onChanged(s)
    setBusy(false)
    setConfirm(false)
    toast('Kartu baru dibuat. Kartu lama sudah tidak berlaku. Ketuk Cetak kartu ini saja.')
  }

  return (
    <Modal open onClose={onClose} title="Kartu presensi">
      <div className="flex justify-center">
        <StudentCard
          student={student}
          className={student.className}
          schoolName={settings.data?.schoolName ?? ''}
          year={years.data?.find((y) => y.isActive)?.name ?? ''}
        />
      </div>
      <div className="mt-5 space-y-2">
        <Link to={`/kartu-qr?siswa=${student.id}`} onClick={onClose} className="block">
          <Button className="w-full" icon={<Printer className="size-4" />}>
            Cetak kartu ini saja
          </Button>
        </Link>
        {!canRegenerate ? (
          <p className="text-sm text-slate-500">Kartu hilang? Minta admin membuat kartu baru. Kartu lama otomatis tidak berlaku.</p>
        ) : confirm ? (
          <div className="rounded-md bg-amber-50 p-3.5 text-sm text-amber-800">
            <p className="font-semibold">Buat kartu baru?</p>
            <p className="mt-0.5">Kartu lama tidak bisa dipakai absen lagi. Lakukan ini hanya jika kartu hilang.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirm(false)}>
                Batal
              </Button>
              <Button size="sm" onClick={regenerate} loading={busy}>
                Ya, buat kartu baru
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setConfirm(true)} icon={<RefreshCcw className="size-4" />}>
            Kartu hilang? Buat kartu baru
          </Button>
        )}
      </div>
    </Modal>
  )
}

export default function SiswaPage() {
  const toast = useToast()
  const isAdmin = useUser().role === 'admin'
  const classes = useLoad(api.getClasses, [])
  const [classFilter, setClassFilter] = useState(0)
  const [query, setQuery] = useState('')
  const students = useLoad(() => api.getStudents(classFilter || undefined), [classFilter])
  const [form, setForm] = useState<Draft | null>(null)
  const [importing, setImporting] = useState(false)
  const [card, setCard] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [busy, setBusy] = useState(false)

  const q = query.trim().toLowerCase()
  const visible = (students.data ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || s.nis.includes(q))

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    await api.deleteStudent(deleting.id)
    setBusy(false)
    toast(`${deleting.name} dihapus`)
    setDeleting(null)
    void students.reload()
  }

  return (
    <>
      <PageHeader
        title="Data Siswa"
        subtitle={`${students.data?.length ?? 0} siswa${classFilter ? ` di kelas ${classes.data?.find((c) => c.id === classFilter)?.name}` : ' terdaftar'}`}
        actions={
          isAdmin && (
          <>
            <Button variant="secondary" onClick={() => setImporting(true)} icon={<Upload className="size-4" />}>
              Import Excel
            </Button>
            <Button
              onClick={() => setForm({ nis: '', name: '', gender: 'L', classId: classFilter || classes.data?.[0]?.id || 0 })}
              disabled={!classes.data?.length}
              icon={<Plus className="size-4" />}
            >
              Tambah siswa
            </Button>
          </>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[200px_1fr]">
        <Select id="filter-kelas" value={classFilter} onChange={(e) => setClassFilter(Number(e.target.value))} className="h-11">
          <option value={0}>Semua kelas</option>
          {classes.data?.map((c) => (
            <option key={c.id} value={c.id}>
              Kelas {c.name}
            </option>
          ))}
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input id="cari-siswa" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama atau NIS" className="h-11 pl-10" />
        </div>
      </div>

      <Card>
        {students.loading && !students.data ? (
          <Spinner />
        ) : visible.length ? (
          <ul className="divide-y divide-slate-100">
            {visible.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{s.name}</p>
                  <p className="text-sm text-slate-500">
                    NIS {s.nis}, kelas {s.className}, {s.gender === 'L' ? 'laki-laki' : 'perempuan'}
                  </p>
                </div>
                <div className="-ml-2 flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setCard(s)} title="Lihat kartu QR" icon={<IdCard className="size-4" />}>
                    Kartu
                  </Button>
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setForm({ ...s })} title="Ubah" icon={<Pencil className="size-4" />}>
                        Ubah
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(s)} title="Hapus" className="text-ink-red hover:bg-rose-50" icon={<Trash2 className="size-4" />}>
                        Hapus
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Users className="size-6" />} title={q ? 'Siswa tidak ditemukan' : 'Belum ada siswa'}>
            {q ? 'Periksa lagi ejaan nama atau NIS.' : 'Tambahkan satu per satu, atau import sekaligus dari Excel.'}
          </EmptyState>
        )}
      </Card>

      {form && classes.data && <StudentForm draft={form} classes={classes.data} onClose={() => setForm(null)} onSaved={() => void students.reload()} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={() => void students.reload()} />}
      {card && (
        <CardModal
          student={card}
          canRegenerate={isAdmin}
          onClose={() => setCard(null)}
          onChanged={(s) => {
            setCard(s)
            void students.reload()
          }}
        />
      )}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Hapus siswa?"
        message={
          <>
            Data <b>{deleting?.name}</b> beserta seluruh riwayat kehadirannya akan dihapus dan tidak bisa dikembalikan.
          </>
        }
        confirmLabel="Hapus siswa"
      />
    </>
  )
}
