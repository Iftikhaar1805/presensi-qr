'use client'

import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Camera, ImageUp, QrCode, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '../lib/nav'
import { Button, Mark } from '../components/ui'
import { useSchool } from '../context/SchoolContext'
import * as api from '../lib/api'
import type { CekKartuResult, Status } from '../lib/types'
import { STATUS_META, cn, formatDateShort } from '../lib/utils'

type Cam = 'idle' | 'starting' | 'running' | 'error'

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')

/**
 * Siswa memindai kartu QR miliknya sendiri untuk melihat kehadirannya. Hanya baca, tanpa login.
 * Mencatat kehadiran tetap dilakukan guru di kelas.
 */
export default function CekKartuPage() {
  const school = useSchool()
  const [cam, setCam] = useState<Cam>('idle')
  const [camError, setCamError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Extract<CekKartuResult, { kind: 'ok' }> | null>(null)
  const [error, setError] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const busyRef = useRef(false)

  const stop = useCallback(async () => {
    const s = scannerRef.current
    if (s?.isScanning) await s.stop().catch(() => {})
    setCam('idle')
  }, [])

  const lookup = useCallback(
    async (code: string) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      setError('')
      try {
        const r = await api.cekKartu(code.trim())
        if (r.kind === 'ok') {
          await stop()
          setResult(r)
        } else {
          setError(r.message)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memeriksa kartu')
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [stop],
  )

  async function start() {
    setCamError('')
    setError('')
    setCam('starting')
    try {
      scannerRef.current ??= new Html5Qrcode('cek-reader', { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false })
      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => ({ width: Math.floor(Math.min(w, h) * 0.7), height: Math.floor(Math.min(w, h) * 0.7) }) },
        (text) => void lookup(text),
        () => {},
      )
      setCam('running')
    } catch (e) {
      const name = e instanceof Error ? e.name : ''
      setCamError(name === 'NotAllowedError' ? 'Kamera belum diizinkan. Ketuk ikon gembok di samping alamat, izinkan Kamera, lalu coba lagi.' : 'Kamera tidak bisa dibuka. Pakai tombol "Pilih foto kartu" di bawah.')
      setCam('error')
    }
  }

  async function fromFile(file: File) {
    setError('')
    try {
      const text = await new Html5Qrcode('cek-file', false).scanFile(file, false)
      await lookup(text)
    } catch {
      setError('Tidak ada QR Code yang terbaca di gambar itu. Pastikan foto kartu jelas dan tidak buram.')
    }
  }

  useEffect(
    () => () => {
      const s = scannerRef.current
      if (s?.isScanning) s.stop().catch(() => {})
    },
    [],
  )

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center gap-3">
          {school.logo ? (
            <img src={school.logo} alt="Logo sekolah" className="size-11 rounded-sm bg-white object-contain p-0.5" />
          ) : (
            <div className="grid size-11 place-items-center rounded-sm bg-stabilo text-brand-900">
              <QrCode className="size-6" />
            </div>
          )}
          <div className="leading-tight">
            <p className="display text-[1.5rem] text-brand-900">Cek Kehadiran Saya</p>
            <p className="text-slate-600">{school.name}</p>
          </div>
        </div>

        {result ? (
          <div>
            <div className="rounded-md bg-brand-900 p-5 text-white">
              <p className="text-brand-100">Kelas {result.className}, NIS {result.nis}</p>
              <p className="display mt-1 text-[2.2rem] leading-none">{result.name}</p>
              <div className="mt-4 rounded-sm bg-white/10 p-3">
                <p className="text-sm text-brand-100">Kehadiran hari ini</p>
                {result.today ? (
                  <p className="mt-1 flex items-center gap-2 text-lg font-bold">
                    <Mark status={result.today.status} />
                    <span className="text-stabilo">{STATUS_META[result.today.status].label}</span>
                    {result.today.checkInTime && <span className="font-normal text-brand-100">jam {hm(result.today.checkInTime)}</span>}
                  </p>
                ) : (
                  <p className="mt-1 text-lg font-bold">Belum tercatat</p>
                )}
              </div>
            </div>

            {result.lessons.length > 0 && (
              <section className="mt-5">
                <h2 className="display text-[1.6rem] text-brand-900">Pelajaran hari ini</h2>
                <ul className="mt-2 divide-y divide-slate-200 rounded-md bg-white ring-1 ring-slate-300">
                  {result.lessons.map((l) => (
                    <li key={l.subjectName} className="flex items-center justify-between px-4 py-3">
                      <span className="font-semibold text-slate-900">{l.subjectName}</span>
                      <span className={cn('flex items-center gap-2 font-semibold', STATUS_META[l.status as Status].text)}>
                        <Mark status={l.status as Status} size="sm" />
                        {STATUS_META[l.status as Status].label}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-5">
              <h2 className="display text-[1.6rem] text-brand-900">14 hari terakhir</h2>
              {result.history.length ? (
                <ul className="mt-2 divide-y divide-slate-200 rounded-md bg-white ring-1 ring-slate-300">
                  {result.history.map((h) => (
                    <li key={h.date} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-slate-700">{formatDateShort(h.date)}</span>
                      <span className={cn('flex items-center gap-2 font-semibold', STATUS_META[h.status].text)}>
                        <Mark status={h.status} size="sm" />
                        {STATUS_META[h.status].label}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-slate-600">Belum ada catatan.</p>
              )}
            </section>

            <Button className="mt-6 w-full" size="lg" variant="secondary" onClick={() => setResult(null)} icon={<RotateCcw className="size-5" />}>
              Pindai kartu lain
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-lg text-slate-700">Arahkan kamera ke kartu QR milikmu untuk melihat catatan kehadiranmu. Absen tetap dilakukan guru di kelas.</p>

            <div className="relative mt-5 overflow-hidden rounded-md bg-brand-900">
              <div id="cek-reader" className={cn('w-full', cam === 'running' ? 'block' : 'hidden')} />
              {cam !== 'running' && (
                <div className="grid min-h-56 place-items-center p-6 text-center text-brand-100">
                  <div>
                    <Camera className="mx-auto size-10 text-stabilo" />
                    <p className="mt-2">{cam === 'starting' ? 'Membuka kamera...' : 'Kamera belum menyala'}</p>
                  </div>
                </div>
              )}
            </div>

            {camError && <p className="mt-3 rounded-md bg-rose-50 p-3 font-semibold text-ink-red">{camError}</p>}
            {error && <p className="mt-3 rounded-md bg-rose-50 p-3 font-semibold text-ink-red">{error}</p>}

            <div className="mt-4 grid gap-3">
              {cam === 'running' ? (
                <Button size="lg" variant="secondary" onClick={() => void stop()}>
                  Matikan kamera
                </Button>
              ) : (
                <Button size="lg" onClick={() => void start()} loading={cam === 'starting' || busy} icon={<Camera className="size-5" />}>
                  Nyalakan kamera
                </Button>
              )}
              <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-5 text-lg font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-100">
                <ImageUp className="size-5" /> Pilih foto kartu
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) void fromFile(f)
                  }}
                />
              </label>
            </div>
            <div id="cek-file" hidden />
          </div>
        )}

        <p className="mt-8 text-center">
          <Link to="/login" className="font-semibold text-brand-600 underline underline-offset-4">
            Masuk sebagai guru atau admin
          </Link>
        </p>
      </div>
    </div>
  )
}
