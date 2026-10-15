'use client'

import { RotateCcw } from 'lucide-react'

/** Tampil bila ada kesalahan tak terduga di sebuah halaman, supaya guru tidak melihat layar putih. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-5">
      <div className="max-w-sm text-center">
        <h1 className="display text-[2.6rem] leading-none text-brand-900">Ada yang tidak beres</h1>
        <p className="mt-3 text-lg text-slate-700">Halaman ini gagal dibuka. Data Anda aman. Ketuk tombol di bawah untuk mencoba lagi.</p>
        <button
          onClick={reset}
          className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-6 text-lg font-semibold text-white hover:bg-brand-700"
        >
          <RotateCcw className="size-5" /> Coba lagi
        </button>
        <a href="/" className="mt-4 inline-flex min-h-12 items-center justify-center font-semibold text-brand-600 underline underline-offset-4">
          Kembali ke awal
        </a>
      </div>
    </div>
  )
}
