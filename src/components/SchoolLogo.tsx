'use client'

import { useSchool } from '../context/SchoolContext'

/**
 * Logo sekolah yang diunggah admin di Pengaturan. Jika belum ada, komponen ini tidak menampilkan apa pun
 * sehingga kartu dan kop laporan tetap rapi.
 */
export default function SchoolLogo({ className }: { className?: string }) {
  const { logo } = useSchool()
  if (!logo) return null
  return <img src={logo} alt="Logo sekolah" className={className} />
}
