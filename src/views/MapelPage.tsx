'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Card, ConfirmModal, EmptyState, Input, PageHeader, Spinner } from '../components/ui'
import { useToast } from '../context/ToastContext'
import * as api from '../lib/api'
import type { Subject } from '../lib/types'
import { useLoad } from '../lib/useLoad'

/** Daftar mata pelajaran yang muncul di pilihan halaman Scan dan rekap. Hanya admin yang mengubahnya. */
export default function MapelPage() {
  const toast = useToast()
  const subjects = useLoad(api.getSubjects, [])
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Subject | null>(null)
  const [busy, setBusy] = useState(false)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    try {
      await api.addSubject(name.trim())
      toast(`${name.trim()} ditambahkan`)
      setName('')
      void subjects.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menambah', 'error')
    } finally {
      setAdding(false)
    }
  }

  async function remove() {
    if (!deleting) return
    setBusy(true)
    await api.deleteSubject(deleting.id)
    setBusy(false)
    toast(`${deleting.name} dihapus`)
    setDeleting(null)
    void subjects.reload()
  }

  return (
    <>
      <PageHeader title="Mata Pelajaran" subtitle="Guru memilih salah satu dari daftar ini saat memindai di kelas." />

      <form onSubmit={add} className="mb-6 flex max-w-lg gap-2">
        <Input id="mapel-baru" value={name} onChange={(e) => setName(e.target.value)} placeholder="contoh: Bahasa Sunda" className="h-12 text-lg" />
        <Button type="submit" size="lg" loading={adding} disabled={!name.trim()} icon={<Plus className="size-5" />}>
          Tambah
        </Button>
      </form>

      <Card className="max-w-lg">
        {subjects.loading && !subjects.data ? (
          <Spinner />
        ) : subjects.data?.length ? (
          <ul className="divide-y divide-slate-200">
            {subjects.data.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-semibold text-slate-800">{s.name}</span>
                <Button variant="ghost" size="sm" className="text-ink-red hover:bg-rose-50" onClick={() => setDeleting(s)} icon={<Trash2 className="size-4" />}>
                  Hapus
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Belum ada mata pelajaran">Tambahkan lewat kolom di atas.</EmptyState>
        )}
      </Card>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        title={`Hapus ${deleting?.name ?? ''}?`}
        message="Seluruh catatan kehadiran pada mata pelajaran ini ikut terhapus dan tidak bisa dikembalikan."
        confirmLabel="Hapus pelajaran"
      />
    </>
  )
}
