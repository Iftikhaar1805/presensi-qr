'use client'

import { ChevronDown, KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Illustration from '../components/Illustration'
import { Button, Card, Field, Input, PageHeader } from '../components/ui'
import { useAuth, useUser } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import * as api from '../lib/api'
import type { Role } from '../lib/types'

export function ProfilPage() {
  const user = useUser()
  const { markPasswordChanged } = useAuth()
  const toast = useToast()
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (newPw !== confirmPw) return setError('Ulangi password baru dengan sama persis')
    setSaving(true)
    try {
      await api.changePassword(oldPw, newPw)
      toast('Password berhasil diganti')
      markPasswordChanged()
      setOldPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengganti password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Profil & Password" />
      <div className="grid max-w-3xl gap-5">
        <Card className="flex items-center gap-4 p-5">
          <div>
            <p className="font-bold text-slate-900">{user.name}</p>
            <p className="text-sm text-slate-500">
              Username: {user.username}
            </p>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
            <KeyRound className="size-5 text-slate-400" /> Ganti password
          </h2>
          <form onSubmit={submit} className="grid gap-4 sm:max-w-sm">
            <Field label="Password lama">
              <Input id="pw-old" type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} required />
            </Field>
            <Field label="Password baru" hint="Minimal 6 karakter">
              <Input id="pw-new" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
            </Field>
            <Field label="Ulangi password baru">
              <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
            </Field>
            {error && <p className="rounded-md bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">{error}</p>}
            <Button type="submit" loading={saving} className="justify-self-start">
              Simpan password baru
            </Button>
          </form>
        </Card>
      </div>
    </>
  )
}

interface Guide {
  image?: string
  title: string
  roles: Role[]
  steps: string[]
}

const GUIDES: Guide[] = [
  {
    image: 'bantuan-scan',
    title: 'Mengajar dan mengabsen siswa',
    roles: ['guru', 'admin'],
    steps: [
      'Buka menu Mengajar (tombol biru tua besar di bawah layar HP).',
      'Pilih pelajaran yang Anda ajar, lalu ketuk Ambil kelas pada kelas yang berstatus Kosong.',
      'Ketuk Nyalakan Kamera. Jika muncul pertanyaan izin kamera, pilih Izinkan.',
      'Pindai kartu siswa satu per satu. Tunggu bunyi "tit" dan stempel HADIR di layar. Nama yang belum dipindai tetap tampil sampai semua selesai.',
      'Di akhir pelajaran, ketuk Akhiri pelajaran. Siswa yang tidak dipindai ditandai tidak hadir, dan kelas kembali Kosong untuk guru berikutnya.',
    ],
  },
  {
    title: 'Kelas terkunci karena sedang diajar guru lain',
    roles: ['guru', 'admin'],
    steps: [
      'Satu kelas hanya bisa diajar satu guru dalam satu waktu. Kelas yang sedang diajar tampil Terkunci beserta nama gurunya.',
      'Tunggu guru itu mengetuk Akhiri pelajaran. Daftar kelas memperbarui diri sendiri, lalu kelas berstatus Kosong dan bisa Anda ambil.',
      'Jika guru lupa keluar, admin bisa mengetuk Kosongkan pada kelas tersebut. Sesi yang lupa diakhiri juga ditutup otomatis keesokan harinya.',
    ],
  },
  {
    title: 'Wali kelas melihat kehadiran kelasnya',
    roles: ['guru', 'admin'],
    steps: [
      'Wali kelas tidak memindai. Kehadiran datang dari guru yang mengajar di kelasnya.',
      'Buka menu Kelas Saya. Di sana tampil siapa yang sedang mengajar, pelajaran apa saja hari ini beserta gurunya, siapa yang hadir, dan siapa yang bolos.',
      'Untuk siswa yang izin atau sakit, ketuk Ubah izin atau sakit lalu pilih nama siswa. Rekap bulanan ada di Rekap & Export.',
    ],
  },
  {
    title: 'Guru mapel menyerahkan rekap ke wali kelas',
    roles: ['guru', 'admin'],
    steps: [
      'Buka Rekap per Pelajaran, pilih kelas, pelajaran, dan periode.',
      'Ketuk Unduh Excel atau Cetak, lalu serahkan ke wali kelas.',
    ],
  },
  {
    title: 'Kartu siswa rusak atau tertinggal',
    roles: ['guru', 'admin'],
    steps: ['Di halaman Scan, ketik NIS siswa pada kolom "Ketik NIS siswa".', 'Ketuk Absen. Hasilnya sama seperti scan kartu.'],
  },
  {
    image: 'bantuan-izin',
    title: 'Mencatat siswa izin atau sakit',
    roles: ['guru', 'admin'],
    steps: [
      'Buka menu Rekap Harian. Kelas yang Anda walikan tampil otomatis.',
      'Ketuk nama siswa yang izin atau sakit.',
      'Pilih Izin atau Sakit, tulis keterangan bila ada, lalu ketuk Simpan status.',
      'Siswa yang tidak scan sampai jam batas otomatis tercatat Alpa. Ubah ke Izin/Sakit bila ada surat.',
    ],
  },
  {
    image: 'bantuan-rekap',
    title: 'Mengunduh rekap bulanan',
    roles: ['guru', 'admin'],
    steps: ['Buka menu Rekap & Export.', 'Pilih kelas dan periode (misalnya Bulan lalu).', 'Ketuk Unduh Excel untuk file Excel, atau Cetak / PDF untuk dicetak.'],
  },
  {
    title: 'Mendaftarkan siswa baru di awal tahun',
    roles: ['admin'],
    steps: [
      'Pastikan kelas sudah dibuat di menu Data Kelas.',
      'Buka Data Siswa, ketuk Import Excel, lalu unduh template.',
      'Isi template di Excel (NIS, Nama, L/P, Kelas), simpan, lalu pilih file tersebut.',
      'Ketuk Import. Setiap siswa langsung mendapat kartu QR.',
      'Cetak kartu lewat menu Cetak Kartu QR, per kelas.',
    ],
  },
  {
    title: 'Mencetak kartu QR siswa',
    roles: ['guru', 'admin'],
    steps: [
      'Buka menu Cetak Kartu QR.',
      'Pilih kelas. Semua kartu siswa kelas itu tampil di layar.',
      'Ketuk Cetak kartu. Di jendela cetak, pilih kertas A4 dan nyalakan Background graphics.',
      'Gunting kartu, lalu laminating agar awet. Satu lembar A4 memuat 8 kartu.',
      'Kartu satu siswa saja: buka Data Siswa, ketuk Kartu pada nama siswa.',
    ],
  },
]

const FAQ: { q: string; a: string; roles: Role[] }[] = [
  {
    q: 'Kamera tidak mau menyala',
    a: 'Pastikan alamat web diawali https://. Ketuk ikon gembok di samping alamat, buka Izin, lalu izinkan Kamera. Tutup aplikasi lain yang memakai kamera seperti WhatsApp, lalu muat ulang halaman.',
    roles: ['guru', 'admin'],
  },
  {
    q: 'Muncul "Kartu tidak dikenal"',
    a: 'Kartu itu kemungkinan kartu lama yang sudah diganti. Pakai Ketik NIS, lalu minta admin mencetak ulang kartu siswa tersebut.',
    roles: ['guru', 'admin'],
  },
  {
    q: 'Siswa datang setelah jam batas',
    a: 'Scan saja seperti biasa. Status Alpa otomatis akan berubah menjadi Terlambat.',
    roles: ['guru', 'admin'],
  },
  { q: 'Lupa password', a: 'Minta admin/TU mereset password. Setelah itu ganti password di menu Profil & Password.', roles: ['guru', 'admin'] },
]

export function BantuanPage() {
  const user = useUser()
  const guides = GUIDES.filter((g) => g.roles.includes(user.role))
  const faq = FAQ.filter((f) => f.roles.includes(user.role))
  const [open, setOpen] = useState<number | null>(0)

  return (
    <>
      <PageHeader title="Bantuan" subtitle="Panduan langkah demi langkah. Ketuk judul untuk membuka." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {guides.map((g, i) => (
            <Card key={g.title} className="overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
                <span className="font-bold text-slate-900">{g.title}</span>
                <ChevronDown className={`size-5 shrink-0 text-slate-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <ol className="space-y-3 px-5 pb-5">
                  {g.image && (
                    <li className="list-none">
                      <Illustration name={g.image} className="mb-2 h-36 w-full object-contain object-left" />
                    </li>
                  )}
                  {g.steps.map((s, n) => (
                    <li key={s} className="flex gap-3 text-slate-700">
                      <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-brand-600 text-sm font-bold text-white">{n + 1}</span>
                      <span className="pt-0.5">{s}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ))}
        </div>
        <Card className="self-start p-5">
          <h2 className="font-bold text-slate-900">Masalah yang sering terjadi</h2>
          <dl className="mt-3 space-y-4">
            {faq.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold text-slate-800">{f.q}</dt>
                <dd className="mt-0.5 text-sm text-slate-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  )
}
