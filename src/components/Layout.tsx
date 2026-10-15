'use client'

import {
  BookOpen,
  BookText,
  Library,
  CalendarCheck,
  Contact,
  House,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  ScanLine,
  School,
  Settings,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from '../lib/nav'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import type { Role } from '../lib/types'
import { cn } from '../lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: Role[]
  group?: string
}

const NAV: NavItem[] = [
  { to: '/beranda', label: 'Beranda', icon: House, roles: ['admin', 'guru'] },
  { to: '/dashboard', label: 'Papan Kehadiran', icon: LayoutDashboard, roles: ['admin', 'guru'] },
  { to: '/scan', label: 'Mengajar & Absen', icon: ScanLine, roles: ['admin', 'guru'] },
  { to: '/kelas-saya', label: 'Kelas Saya', icon: Users, roles: ['admin', 'guru'] },
  { to: '/rekap-harian', label: 'Rekap Harian', icon: CalendarCheck, roles: ['admin', 'guru'] },
  { to: '/rekap-mapel', label: 'Rekap per Pelajaran', icon: BookText, roles: ['admin', 'guru'] },
  { to: '/laporan', label: 'Rekap & Export', icon: FileBarChart, roles: ['admin', 'guru'] },
  { to: '/siswa', label: 'Data Siswa', icon: GraduationCap, roles: ['admin', 'guru'], group: 'Data sekolah' },
  { to: '/kartu-qr', label: 'Cetak Kartu QR', icon: QrCode, roles: ['admin', 'guru'], group: 'Data sekolah' },
  { to: '/guru', label: 'Data Guru', icon: Contact, roles: ['admin'], group: 'Data sekolah' },
  { to: '/kelas', label: 'Data Kelas', icon: School, roles: ['admin'], group: 'Data sekolah' },
  { to: '/mapel', label: 'Mata Pelajaran', icon: Library, roles: ['admin'], group: 'Data sekolah' },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings, roles: ['admin'], group: 'Akun & bantuan' },
  { to: '/profil', label: 'Profil & Password', icon: UserCog, roles: ['admin', 'guru'], group: 'Akun & bantuan' },
  { to: '/bantuan', label: 'Bantuan', icon: BookOpen, roles: ['admin', 'guru'], group: 'Akun & bantuan' },
]

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin / TU', guru: 'Guru' }

/** Merek: kotak QR kuning stabilo di atas biru tinta, seperti stiker di sampul buku */
function Brand({ light = false }: { light?: boolean }) {
  const { name, logo } = useSchool()
  return (
    <div className="flex items-center gap-3">
      {logo ? (
        <img src={logo} alt="Logo sekolah" className="size-10 shrink-0 rounded-sm bg-white object-contain p-0.5" />
      ) : (
        <div className="grid size-10 shrink-0 place-items-center rounded-sm bg-stabilo text-brand-900">
          <QrCode className="size-6" strokeWidth={2.25} />
        </div>
      )}
      <div className="leading-none">
        <p className={cn('display text-[1.55rem]', light ? 'text-white' : 'text-brand-900')}>Presensi QR</p>
        <p className={cn('mt-1 text-sm', light ? 'text-brand-200' : 'text-slate-500')}>{name}</p>
      </div>
    </div>
  )
}

function NavList({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const items = NAV.filter((n) => n.roles.includes(role))
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item, i) => {
        const header = item.group !== items[i - 1]?.group ? item.group : undefined
        return (
          <div key={item.to}>
            {header && <p className="mt-7 mb-2 px-3 text-sm font-semibold text-brand-200/80">{header}</p>}
            <NavLink
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-sm px-3 font-semibold transition-colors',
                  isActive ? 'bg-stabilo text-brand-900' : 'text-brand-100 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <item.icon className="size-[1.15rem] shrink-0" strokeWidth={2} />
              {item.label}
            </NavLink>
          </div>
        )
      })}
    </nav>
  )
}

function UserBox({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  if (!user) return null
  return (
    <div className="border-t border-white/15 pt-4">
      <p className="truncate font-bold text-white">{user.name}</p>
      <p className="text-sm text-brand-200">{ROLE_LABEL[user.role]}</p>
      <button onClick={onLogout} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-sm font-semibold text-stabilo hover:underline">
        <LogOut className="size-4" /> Keluar
      </button>
    </div>
  )
}

function BottomNav({ onMenu }: { onMenu: () => void }) {
  const items: { to: string; label: string; icon: LucideIcon; primary?: boolean }[] = [
    { to: '/beranda', label: 'Beranda', icon: House },
    { to: '/scan', label: 'Mengajar', icon: ScanLine, primary: true },
  ]
  const base = 'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-bold'
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-300 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) =>
            cn(base, it.primary ? 'bg-brand-900 text-stabilo' : isActive ? 'text-brand-900' : 'text-slate-500')
          }
        >
          {({ isActive }) => (
            <>
              {isActive && !it.primary && <span className="absolute inset-x-3 top-0 h-1 bg-stabilo" />}
              <it.icon className="size-6" strokeWidth={it.primary ? 2.25 : 2} />
              {it.label}
            </>
          )}
        </NavLink>
      ))}
      <button onClick={onMenu} className={cn(base, 'text-slate-500')}>
        <Menu className="size-6" />
        Menu
      </button>
    </nav>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const school = useSchool()

  useEffect(() => setDrawer(false), [location.pathname])

  if (!user) return null
  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-full">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-900 px-4 py-6 lg:flex">
        <div className="px-1">
          <Brand light />
        </div>
        <div className="mt-8 flex-1 overflow-y-auto [scrollbar-color:rgb(255_255_255/0.25)_transparent] [scrollbar-width:thin]">
          <NavList role={user.role} />
        </div>
        <UserBox onLogout={handleLogout} />
      </aside>

      <header className="no-print sticky top-0 z-20 flex items-center justify-between bg-brand-900 px-4 py-2.5 lg:hidden">
        <Brand light />
        <p className="max-w-[40%] truncate text-sm font-semibold text-brand-100">{user.name.split(',')[0]}</p>
      </header>

      {drawer && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-brand-900 px-4 py-5">
            <div className="flex items-center justify-between px-2">
              <p className="display text-2xl text-white">Menu</p>
              <button onClick={() => setDrawer(false)} className="rounded-sm p-2 text-brand-200 hover:bg-white/10" aria-label="Tutup menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto [scrollbar-color:rgb(255_255_255/0.25)_transparent] [scrollbar-width:thin]">
              <NavList role={user.role} onNavigate={() => setDrawer(false)} />
            </div>
            <UserBox onLogout={handleLogout} />
          </div>
        </div>
      )}

      {user.weakPassword && school.loaded && !school.demoAccounts && (
        <div className="no-print bg-stabilo px-4 py-2.5 text-brand-900 lg:ml-64 lg:px-12">
          <p className="mx-auto max-w-6xl font-semibold">
            Anda masih memakai password bawaan. Siapa pun yang tahu alamat web ini bisa masuk.{' '}
            <NavLink to="/profil" className="inline-flex min-h-11 items-center font-extrabold underline underline-offset-4">
              Ganti password sekarang
            </NavLink>
          </p>
        </div>
      )}

      <main className="px-4 pt-6 pb-28 sm:px-6 lg:ml-64 lg:px-12 lg:pt-10 lg:pb-14 print:m-0 print:p-0">
        <div className="mx-auto max-w-6xl">
          {children}
        </div>
      </main>

      <BottomNav onMenu={() => setDrawer(true)} />
    </div>
  )
}
