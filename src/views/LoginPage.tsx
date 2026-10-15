'use client'

import { Eye, EyeOff, LogIn, QrCode } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from '../lib/nav'
import Illustration from '../components/Illustration'
import StudentCard from '../components/StudentCard'
import { Button, Field, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import type { Role, Student } from '../lib/types'

export function homeFor(role: Role): string {
  return role === 'guru' || role === 'admin' ? '/beranda' : '/dashboard'
}

// Akun contoh dari data demo (lihat backend/src/seed.ts) untuk latihan saat PKM
const DEMO = [
  { label: 'Guru', username: 'guru', password: 'guru123' },
  { label: 'Admin / TU', username: 'admin', password: 'admin123' },
]

const SAMPLE: Student = { id: 0, nis: '20250001', name: 'Ahmad Pratama', gender: 'L', classId: 0, className: '7A', qrToken: 'contoh-kartu-presensi-smp-dharma-bakti-2026' }

export default function LoginPage() {
  const { user, login } = useAuth()
  const school = useSchool()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={homeFor(user.role)} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!username || !password) return setError('Isi username dan password terlebih dahulu.')
    setLoading(true)
    try {
      const u = await login(username, password)
      navigate(homeFor(u.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Kertas buku tulis: garis biru, margin merah, kartu presensi di atasnya */}
      <div className="kertas hidden overflow-hidden lg:flex lg:w-[52%] lg:flex-col lg:justify-between lg:gap-8 lg:border-r lg:border-slate-300 lg:py-8 lg:pr-12 lg:pl-[5.5rem]">
        <div className="flex items-center gap-3">
          {school.logo ? (
            <img src={school.logo} alt="Logo sekolah" className="size-9 rounded-sm bg-white object-contain p-0.5" />
          ) : (
            <div className="grid size-9 place-items-center rounded-sm bg-stabilo text-brand-900">
              <QrCode className="size-5" />
            </div>
          )}
          <div className="leading-tight">
            <p className="display text-[1.5rem] text-brand-900">Presensi QR</p>
            <p className="text-slate-600">{school.name}</p>
          </div>
        </div>

        <div>
          <h1 className="display max-w-md text-[clamp(2.6rem,8dvh,4rem)] leading-[1.02] text-brand-900">Tunjukkan kartu, langsung tercatat.</h1>
          <p className="mt-4 max-w-sm text-lg leading-8 text-slate-700">Tidak ada lagi memanggil nama satu per satu. Rekap bulanan tinggal diunduh.</p>
        </div>

        <div className="mb-2 ml-2 w-fit origin-bottom-left -rotate-2 [@media(min-height:860px)]:mb-8 [@media(min-height:860px)]:scale-[1.35]">
          <StudentCard student={SAMPLE} className="7A" schoolName={school.name} year="2025/2026" />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-5 sm:py-10">
        <div className="w-full max-w-sm">
          <div className="mb-4 flex items-center gap-3 sm:mb-8 lg:hidden">
            {school.logo ? (
              <img src={school.logo} alt="Logo sekolah" className="size-10 rounded-sm bg-white object-contain p-0.5" />
            ) : (
              <div className="grid size-10 place-items-center rounded-sm bg-stabilo text-brand-900">
                <QrCode className="size-6" />
              </div>
            )}
            <div className="leading-tight">
              <p className="text-lg font-extrabold text-slate-900">Presensi QR</p>
              <p className="text-slate-500">{school.name}</p>
            </div>
          </div>

          {/* Tinggi ilustrasi mengikuti tinggi layar supaya tombol Masuk selalu terlihat tanpa menggulir */}
          <Illustration name="login-hero" className="mb-3 h-[min(12rem,19dvh)] w-full rounded-md object-cover object-center [@media(max-height:600px)]:h-[15dvh]" />
          <h2 className="display text-[2.25rem] leading-none text-brand-900 sm:text-[3rem]">Masuk</h2>
          <p className="mt-1 text-slate-600">Masuk dengan username dan password dari TU sekolah.</p>

          <form onSubmit={submit} className="mt-4 space-y-3 sm:mt-7 sm:space-y-5">
            <Field label="Username">
              <Input id="username" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} className="min-h-12 text-lg" />
            </Field>
            <Field label="Password">
              <div className="relative">
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-12 pr-24 text-lg"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center gap-1.5 px-3.5 font-semibold text-brand-600 hover:text-brand-700"
                  aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  {show ? 'Tutup' : 'Lihat'}
                </button>
              </div>
            </Field>
            {error && (
              <p role="alert" className="border-l-4 border-ink-red bg-rose-50 px-3.5 py-2.5 font-semibold text-ink-red">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" loading={loading} icon={<LogIn className="size-5" />}>
              Masuk
            </Button>
          </form>

          <Link to="/cek-kartu" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-md bg-stabilo px-4 text-center font-bold text-brand-900 hover:brightness-95">
            <QrCode className="size-5" /> Siswa? Cek kehadiranmu di sini
          </Link>

          {school.demoAccounts && (
          <div className="mt-10 border-t border-slate-300 pt-5">
            <p className="font-bold text-slate-800">Sedang latihan? Isi otomatis dengan akun contoh:</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {DEMO.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => {
                    setUsername(d.username)
                    setPassword(d.password)
                    setError('')
                  }}
                  className="min-h-10 font-bold text-brand-600 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-600"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
