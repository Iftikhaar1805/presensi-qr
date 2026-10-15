'use client'

import { KeyRound, Pencil, Plus, School, Trash2, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Card, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner } from '../components/ui'
import { useToast } from '../context/ToastContext'
import * as api from '../lib/api'
import type { SchoolClass, Teacher } from '../lib/types'
import { useLoad } from '../lib/useLoad'

// ───────────────────────── Guru ─────────────────────────

type TeacherDraft = { id?: number; nip: string; name: string; phone: string; username: string; subjectIds: number[] }

function TeacherForm({ draft, onClose, onSaved }: { draft: TeacherDraft; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [d, setD] = useState(draft)
  const subjects = useLoad(api.getSubjects, [])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.saveTeacher(d)
      toast(d.id ? 'Data guru diperbarui' : `Guru ditambahkan. Login: ${d.username} / guru123`)
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
      title={d.id ? 'Ubah data guru' : 'Tambah guru'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="teacher-form" loading={saving}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="teacher-form" onSubmit={submit} className="space-y-4">
        <Field label="Nama lengkap & gelar">
          <Input id="t-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="contoh: Dedi Supriadi, S.Pd." required />
        </Field>
        <Field label="NIP (boleh kosong)">
          <Input id="t-nip" inputMode="numeric" value={d.nip} onChange={(e) => setD({ ...d, nip: e.target.value })} />
        </Field>
        <Field label="No. HP / WhatsApp">
          <Input id="t-phone" inputMode="tel" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 font-semibold text-slate-800">Mata pelajaran yang diampu</legend>
          <p className="mb-2 text-sm text-slate-500">Guru hanya melihat pelajaran yang dicentang saat mengambil kelas. Kosongkan semua jika boleh mengajar apa saja.</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {subjects.data?.map((s) => (
              <label key={s.id} className="flex min-h-10 cursor-pointer items-center gap-2 text-slate-800">
                <input
                  type="checkbox"
                  className="size-5 accent-brand-600"
                  checked={d.subjectIds.includes(s.id)}
                  onChange={(e) => setD({ ...d, subjectIds: e.target.checked ? [...d.subjectIds, s.id] : d.subjectIds.filter((x) => x !== s.id) })}
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
        {!d.id && (
          <Field label="Username untuk login" hint="Password awal: guru123. Guru bisa menggantinya sendiri.">
            <Input id="t-username" autoCapitalize="none" value={d.username} onChange={(e) => setD({ ...d, username: e.target.value.replace(/\s/g, '').toLowerCase() })} required />
          </Field>
        )}
        {error && <p className="rounded-md bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">{error}</p>}
      </form>
    </Modal>
  )
}

export function GuruPage() {
  const toast = useToast()
  const teachers = useLoad(api.getTeachers, [])
  const classes = useLoad(api.getClasses, [])
  const [form, setForm] = useState<TeacherDraft | null>(null)
  const [deleting, setDeleting] = useState<Teacher | null>(null)
  const [busy, setBusy] = useState(false)

  async function resetPw(t: Teacher) {
    const pw = await api.resetTeacherPassword(t.id)
    toast(`Password ${t.name} direset menjadi "${pw}"`)
  }

  function edit(t: Teacher) {
    setForm({ ...t })
  }

  return (
    <>
      <PageHeader
        title="Data Guru"
        subtitle="Setiap guru otomatis punya akun untuk scan presensi."
        actions={
          <Button onClick={() => setForm({ nip: '', name: '', phone: '', username: '', subjectIds: [] })} icon={<Plus className="size-4" />}>
            Tambah guru
          </Button>
        }
      />
      <Card>
        {teachers.loading && !teachers.data ? (
          <Spinner />
        ) : teachers.data?.length ? (
          <ul className="divide-y divide-slate-100">
            {teachers.data.map((t) => {
              const wali = classes.data?.filter((c) => c.homeroomTeacherId === t.id).map((c) => c.name)
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{t.name}</p>
                    <p className="truncate text-sm text-slate-500">
                      {wali?.length ? `Wali kelas ${wali.join(', ')}` : 'Bukan wali kelas'}
                      {t.phone && `, HP ${t.phone}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => void resetPw(t)} title="Reset password" icon={<KeyRound className="size-4" />}>
                      <span className="max-sm:sr-only">Reset sandi</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void edit(t)} title="Ubah" icon={<Pencil className="size-4" />}>
                      <span className="max-sm:sr-only">Ubah</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(t)} title="Hapus" className="text-ink-red hover:bg-rose-50" icon={<Trash2 className="size-4" />}>
                      <span className="max-sm:sr-only">Hapus</span>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState icon={<UserRound className="size-6" />} title="Belum ada guru">
            Tambahkan guru agar bisa login dan melakukan scan presensi.
          </EmptyState>
        )}
      </Card>
      {form && (
        <TeacherForm
          draft={form}
          onClose={() => setForm(null)}
          onSaved={() => {
            void teachers.reload()
            void classes.reload()
          }}
        />
      )}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        loading={busy}
        onConfirm={async () => {
          setBusy(true)
          await api.deleteTeacher(deleting!.id)
          setBusy(false)
          toast('Guru dihapus')
          setDeleting(null)
          void teachers.reload()
          void classes.reload()
        }}
        title="Hapus guru?"
        message={
          <>
            Akun login <b>{deleting?.name}</b> ikut dihapus. Jika ia wali kelas, kelasnya akan tanpa wali sampai diatur ulang.
          </>
        }
        confirmLabel="Hapus guru"
      />
    </>
  )
}

// ───────────────────────── Kelas ─────────────────────────

type ClassDraft = { id?: number; name: string; grade: number; homeroomTeacherId: number | null }

function ClassForm({ draft, teachers, onClose, onSaved }: { draft: ClassDraft; teachers: Teacher[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [d, setD] = useState(draft)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.saveClass(d)
      toast(d.id ? 'Kelas diperbarui' : `Kelas ${d.name.toUpperCase()} ditambahkan`)
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
      title={d.id ? 'Ubah kelas' : 'Tambah kelas'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="class-form" loading={saving}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tingkat">
            <Select id="c-grade" value={d.grade} onChange={(e) => setD({ ...d, grade: Number(e.target.value) })}>
              <option value={7}>Kelas 7</option>
              <option value={8}>Kelas 8</option>
              <option value={9}>Kelas 9</option>
            </Select>
          </Field>
          <Field label="Nama kelas">
            <Input id="c-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder={`${d.grade}A`} required />
          </Field>
        </div>
        <Field label="Wali kelas" hint="Wali kelas bisa mengubah status izin/sakit siswanya">
          <Select id="c-homeroom" value={d.homeroomTeacherId ?? ''} onChange={(e) => setD({ ...d, homeroomTeacherId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Belum ada</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        {error && <p className="rounded-md bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">{error}</p>}
      </form>
    </Modal>
  )
}

export function KelasPage() {
  const toast = useToast()
  const classes = useLoad(api.getClasses, [])
  const teachers = useLoad(api.getTeachers, [])
  const students = useLoad(() => api.getStudents(), [])
  const [form, setForm] = useState<ClassDraft | null>(null)
  const [deleting, setDeleting] = useState<SchoolClass | null>(null)
  const [busy, setBusy] = useState(false)

  const countOf = (id: number) => students.data?.filter((s) => s.classId === id).length ?? 0

  return (
    <>
      <PageHeader
        title="Data Kelas"
        subtitle="Kelas pada tahun ajaran yang sedang aktif."
        actions={
          <Button onClick={() => setForm({ name: '', grade: 7, homeroomTeacherId: null })} icon={<Plus className="size-4" />}>
            Tambah kelas
          </Button>
        }
      />
      {classes.loading && !classes.data ? (
        <Spinner />
      ) : classes.data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.data.map((c) => (
            <Card key={c.id} className="flex items-center gap-4 p-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-md bg-brand-600 text-lg font-extrabold text-white">{c.name}</div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900">{countOf(c.id)} siswa</p>
                <p className="truncate text-sm text-slate-500">Wali: {teachers.data?.find((t) => t.id === c.homeroomTeacherId)?.name ?? 'belum ada'}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="sm" onClick={() => setForm({ ...c })} title="Ubah" icon={<Pencil className="size-4" />}>
                      <span className="max-sm:sr-only">Ubah</span>
                    </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(c)} title="Hapus" className="text-ink-red hover:bg-rose-50" icon={<Trash2 className="size-4" />}>
                      <span className="max-sm:sr-only">Hapus</span>
                    </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<School className="size-6" />} title="Belum ada kelas">
            Tambahkan kelas sebelum memasukkan data siswa.
          </EmptyState>
        </Card>
      )}
      {form && teachers.data && <ClassForm draft={form} teachers={teachers.data} onClose={() => setForm(null)} onSaved={() => void classes.reload()} />}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        loading={busy}
        onConfirm={async () => {
          setBusy(true)
          try {
            await api.deleteClass(deleting!.id)
            toast(`Kelas ${deleting!.name} dihapus`)
            void classes.reload()
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Gagal menghapus', 'error')
          }
          setBusy(false)
          setDeleting(null)
        }}
        title={`Hapus kelas ${deleting?.name ?? ''}?`}
        message="Kelas hanya bisa dihapus jika sudah tidak ada siswanya."
        confirmLabel="Hapus kelas"
      />
    </>
  )
}
