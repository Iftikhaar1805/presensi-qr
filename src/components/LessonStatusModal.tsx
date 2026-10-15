'use client'

import { useEffect, useState } from 'react'
import { useToast } from '../context/ToastContext'
import * as api from '../lib/api'
import type { LessonRow, Status, TeachingSession } from '../lib/types'
import { STATUS_META, cn } from '../lib/utils'
import { Button, Field, Input, Modal } from './ui'

const CHOICES: Status[] = ['hadir', 'izin', 'sakit', 'alpa']

/**
 * Guru mengoreksi kehadiran satu siswa di pelajarannya: salah memindai, siswa izin atau sakit,
 * atau siswa yang kartunya tertinggal tetapi ada di kelas.
 */
export default function LessonStatusModal({ row, session, onClose, onSaved }: { row: LessonRow | null; session: TeachingSession; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [status, setStatus] = useState<Status>('hadir')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!row) return
    setStatus(row.lesson?.status && CHOICES.includes(row.lesson.status) ? row.lesson.status : 'hadir')
    setNote(row.lesson?.note.startsWith('Tidak hadir') ? '' : (row.lesson?.note ?? ''))
  }, [row])

  if (!row) return null

  async function save() {
    setSaving(true)
    try {
      await api.setLesson(row!.student.id, session.subjectId, session.date, status, note.trim())
      toast(`${row!.student.name}: ${STATUS_META[status].label} di ${session.subjectName}`)
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
      title={`Ubah kehadiran, ${session.subjectName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Simpan
          </Button>
        </>
      }
    >
      <p className="font-bold text-slate-900">{row.student.name}</p>
      <p className="mb-4 text-slate-600">
        NIS {row.student.nis}, kelas {row.student.className}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CHOICES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              'flex min-h-12 items-center gap-2 rounded-md px-3 text-left font-semibold ring-1 transition-colors',
              status === s ? `${STATUS_META[s].soft} ring-2 ring-current` : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100',
            )}
          >
            <span className={cn('size-3 rounded-[2px]', STATUS_META[s].dot)} />
            {STATUS_META[s].label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Field label="Keterangan (boleh dikosongkan)" hint="Contoh: ke UKS, kartu tertinggal">
          <Input id="lesson-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
