'use client'

import {
  BookOpen,
  BookText,
  CalendarCheck,
  Contact,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  Library,
  QrCode,
  ScanLine,
  School,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from '../lib/nav'
import { useUser } from '../context/AuthContext'
import * as api from '../lib/api'
import { useLoad } from '../lib/useLoad'
import type { Role } from '../lib/types'

interface Tile {
  to: string
  label: string
  hint: string
  icon: LucideIcon
  roles?: Role[]
}

// Menu harian: yang dipakai guru setiap hari. Tiap kotak satu tujuan, tulisan besar, tanpa istilah teknis.
const HARIAN: Tile[] = [
  { to: '/kelas-saya', label: 'Kelas Saya', hint: 'Lihat siapa yang hadir', icon: Users },
  { to: '/dashboard', label: 'Papan Kehadiran', hint: 'Semua kelas hari ini', icon: LayoutDashboard },
  { to: '/rekap-harian', label: 'Izin dan Sakit', hint: 'Catat siswa tidak masuk', icon: CalendarCheck },
  { to: '/rekap-mapel', label: 'Rekap Pelajaran', hint: 'Unduh untuk wali kelas', icon: BookText },
  { to: '/laporan', label: 'Rekap Bulanan', hint: 'Unduh Excel atau cetak', icon: FileBarChart },
]

const KELOLA: Tile[] = [
  { to: '/siswa', label: 'Data Siswa', hint: 'Tambah dan ubah siswa', icon: GraduationCap },
  { to: '/kartu-qr', label: 'Cetak Kartu QR', hint: 'Satu kartu atau satu kelas', icon: QrCode },
  { to: '/guru', label: 'Data Guru', hint: 'Akun dan pelajaran guru', icon: Contact, roles: ['admin'] },
  { to: '/kelas', label: 'Data Kelas', hint: 'Kelas dan wali kelas', icon: School, roles: ['admin'] },
  { to: '/mapel', label: 'Mata Pelajaran', hint: 'Daftar pelajaran', icon: Library, roles: ['admin'] },
  { to: '/pengaturan', label: 'Pengaturan', hint: 'Jam, logo, tahun ajaran', icon: Settings, roles: ['admin'] },
]

const BANTUAN: Tile[] = [
  { to: '/bantuan', label: 'Bantuan', hint: 'Cara memakai aplikasi', icon: BookOpen },
  { to: '/profil', label: 'Akun Saya', hint: 'Ganti password', icon: UserCog },
]

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 19) return 'Selamat sore'
  return 'Selamat malam'
}

function TileGrid({ tiles, role }: { tiles: Tile[]; role: Role }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {tiles
        .filter((t) => !t.roles || t.roles.includes(role))
        .map((t) => (
          <li key={t.to}>
            <Link
              to={t.to}
              className="flex h-full min-h-[10.5rem] flex-col items-start gap-3 rounded-md bg-white p-4 ring-1 ring-slate-300 transition-colors hover:bg-brand-50 hover:ring-brand-500 active:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-sm bg-brand-900 text-stabilo">
                <t.icon className="size-8" strokeWidth={2} />
              </span>
              <span>
                <span className="block text-[1.2rem] leading-tight font-bold text-slate-900">{t.label}</span>
                <span className="mt-1 block leading-snug text-slate-600">{t.hint}</span>
              </span>
            </Link>
          </li>
        ))}
    </ul>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="display mb-3 text-[1.9rem] text-brand-900">{title}</h2>
      {children}
    </section>
  )
}

/**
 * Beranda: satu layar dengan kotak menu besar, bergaya aplikasi mobile banking.
 * Bagian atas menunjukkan keadaan sekarang (sedang mengajar atau belum) dengan satu tombol utama.
 */
export default function BerandaPage() {
  const user = useUser()
  const mine = useLoad(api.getMySession, [])
  const session = mine.data
  const name = user.name.split(',')[0]

  return (
    <>
      <p className="text-slate-600">{greeting()},</p>
      <h1 className="display text-[2.4rem] leading-none text-brand-900 sm:text-[3rem]">{name}</h1>

      <div className="mt-6 rounded-md bg-brand-900 p-5 text-white sm:p-6">
        {mine.loading && !mine.data ? (
          <p className="text-brand-100">Memeriksa kelas Anda...</p>
        ) : session ? (
          <>
            <p className="text-brand-100">Anda sedang mengajar</p>
            <p className="display mt-1 text-[2.3rem] leading-none text-stabilo sm:text-[2.8rem]">
              {session.subjectName}, kelas {session.className}
            </p>
            <p className="mt-2 text-brand-100">Sejak jam {session.startedAt.slice(11, 16)}</p>
            <Link to="/scan" className="mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-md bg-stabilo px-5 text-lg font-extrabold text-brand-900 hover:brightness-95 sm:w-auto sm:min-w-72">
              <ScanLine className="size-6" /> Lanjut memindai
            </Link>
          </>
        ) : (
          <>
            <p className="display text-[2.3rem] leading-none sm:text-[2.8rem]">Belum mengajar</p>
            <p className="mt-2 max-w-md text-brand-100">Pilih pelajaran dan ambil kelas yang kosong. Setelah itu kartu siswa bisa dipindai.</p>
            <Link to="/scan" className="mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-md bg-stabilo px-5 text-lg font-extrabold text-brand-900 hover:brightness-95 sm:w-auto sm:min-w-72">
              <ScanLine className="size-6" /> Mulai mengajar
            </Link>
          </>
        )}
      </div>

      <Group title="Menu harian">
        <TileGrid tiles={HARIAN} role={user.role} />
      </Group>
      <Group title="Data dan kartu">
        <TileGrid tiles={KELOLA} role={user.role} />
      </Group>
      <Group title="Bantuan">
        <TileGrid tiles={BANTUAN} role={user.role} />
      </Group>
    </>
  )
}
