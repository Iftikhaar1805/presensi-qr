'use client'

import { QRCodeSVG } from 'qrcode.react'
import type { Student } from '../lib/types'
import SchoolLogo from './SchoolLogo'

/**
 * Kartu presensi siswa, ukuran kartu pelajar (85,6 × 54 mm).
 * Isi QR adalah token acak, bukan NIS, supaya kartu tidak bisa dipalsukan dari NIS.
 */
export default function StudentCard({ student, className, schoolName, year }: { student: Student; className: string; schoolName: string; year: string }) {
  return (
    <div
      className="avoid-break relative flex aspect-[85.6/54] w-full max-w-[340px] flex-col overflow-hidden rounded-md bg-white text-slate-900 ring-1 ring-slate-300 print:w-[85.6mm] print:max-w-none print:rounded-[3mm]"
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      <div className="flex items-center justify-between gap-2 bg-brand-700 px-[5%] py-[2.6%] text-white">
        <SchoolLogo className="size-7 shrink-0 rounded-sm bg-white object-contain p-0.5 print:size-[8mm]" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12px] font-extrabold print:text-[8pt]">Kartu Presensi Siswa</p>
          <p className="truncate text-[9px] text-brand-100 print:text-[6.5pt]">{schoolName}</p>
        </div>
        <p className="shrink-0 text-[9px] font-semibold text-brand-100 print:text-[6.5pt]">T.A. {year}</p>
      </div>
      <div className="flex flex-1 items-center gap-[4%] px-[5%] py-[3%]">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] leading-tight font-extrabold print:text-[10.5pt]">{student.name}</p>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 text-[11px] print:text-[7.5pt]">
            <dt className="text-slate-500">NIS</dt>
            <dd className="font-bold tabular-nums">{student.nis}</dd>
            <dt className="text-slate-500">Kelas</dt>
            <dd className="font-bold">{className}</dd>
          </dl>
          <p className="mt-2 text-[8.5px] leading-snug text-slate-500 print:text-[6pt]">Tunjukkan kartu ini saat guru memindai di kelas.</p>
        </div>
        <div className="aspect-square h-full max-h-[118px] shrink-0 rounded-md bg-white p-1 ring-1 ring-slate-200 print:max-h-none print:w-[28mm]">
          <QRCodeSVG value={student.qrToken} level="M" marginSize={2} className="h-full w-full" />
        </div>
      </div>
      {/* garis merah putih */}
      <div className="flex h-[3%] min-h-1">
        <div className="flex-1 bg-rose-600" />
        <div className="flex-1 bg-slate-100" />
      </div>
    </div>
  )
}
