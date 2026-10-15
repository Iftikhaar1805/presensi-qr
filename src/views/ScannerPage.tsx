'use client'

import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Camera, CameraOff, DoorOpen, ImageUp, Keyboard, RefreshCcw, SwitchCamera, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import Cells from '../components/Cells'
import Illustration from '../components/Illustration'
import LessonStatusModal from '../components/LessonStatusModal'
import TakeClass from '../components/TakeClass'
import { Button, Card, Input, PageHeader, Spinner } from '../components/ui'
import { useToast } from '../context/ToastContext'
import * as api from '../lib/api'
import type { LessonRow, ScanResult, Settings, TeachingSession } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { STATUS_META, cn, minutesOf } from '../lib/utils'

type CamState = 'idle' | 'starting' | 'running' | 'error'

// ── Suara dan getar sebagai tanda hasil scan (guru tidak perlu melihat layar terus) ──
let audioCtx: AudioContext | null = null
function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine') {
  if (!audioCtx) return
  const o = audioCtx.createOscillator()
  const g = audioCtx.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0.18, audioCtx.currentTime + start)
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + dur)
  o.connect(g).connect(audioCtx.destination)
  o.start(audioCtx.currentTime + start)
  o.stop(audioCtx.currentTime + start + dur)
}
function feedback(kind: ScanResult['kind'], late: boolean, sound: boolean) {
  if (sound) {
    try {
      audioCtx ??= new AudioContext()
      if (kind === 'ok' && !late) {
        tone(1320, 0, 0.15)
      } else if (kind === 'ok') {
        tone(880, 0, 0.12)
        tone(880, 0.18, 0.12)
      } else if (kind === 'duplicate') {
        tone(660, 0, 0.1)
        tone(660, 0.15, 0.1)
      } else {
        tone(220, 0, 0.4, 'square')
      }
    } catch {
      // perangkat tanpa audio
    }
  }
  try {
    navigator.vibrate?.(kind === 'ok' ? 80 : [80, 60, 80])
  } catch {
    // abaikan
  }
}

function cameraErrorText(err: unknown): string {
  const msg = String(err instanceof Error ? err.message : err)
  if (!window.isSecureContext) return 'Kamera hanya bisa dipakai lewat alamat https://. Buka aplikasi dari alamat https, atau pakai Ketik NIS di bawah.'
  if (/NotAllowed|Permission/i.test(msg)) return 'Izin kamera ditolak. Ketuk ikon gembok di samping alamat web, pilih Kamera lalu Izinkan, kemudian coba lagi.'
  if (/NotFound|no camera|Requested device not found/i.test(msg)) return 'Kamera tidak ditemukan di perangkat ini. Pakai Ketik NIS di bawah.'
  if (/NotReadable|in use/i.test(msg)) return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera atau WhatsApp, lalu coba lagi.'
  return 'Kamera gagal dinyalakan. Coba muat ulang halaman, atau pakai Ketik NIS di bawah.'
}

function lateMinutes(time: string | null, settings: Settings | null): number {
  if (!time || !settings) return 0
  return Math.max(0, minutesOf(time) - minutesOf(settings.checkInTime))
}

/** Hasil scan tampil sebagai stempel besar: terbaca dari jarak satu lengan, tanpa perlu membaca teks kecil. */
function ResultPanel({ result, settings, otherClass, onClose }: { result: ScanResult; settings: Settings | null; otherClass: boolean; onClose: () => void }) {
  if (result.kind === 'invalid' || result.kind === 'closed') {
    return (
      <button onClick={onClose} className="flex h-full w-full flex-col items-center justify-center gap-6 bg-ink-red p-6 text-center text-white">
        <span className="stamp text-[2.2rem] sm:text-5xl">{result.kind === 'closed' ? 'DITUTUP' : 'TIDAK DIKENAL'}</span>
        <p className="max-w-xs text-lg font-semibold">{result.message}</p>
      </button>
    )
  }
  const { student, attendance, className } = result
  const late = attendance.status === 'terlambat'
  const dup = result.kind === 'duplicate'
  const tone = dup ? 'bg-brand-700 text-white' : late ? 'bg-stabilo text-brand-900' : 'bg-emerald-800 text-white'
  const mins = lateMinutes(attendance.checkInTime, settings)
  const stamp = dup ? 'SUDAH ABSEN' : late ? 'TERLAMBAT' : 'HADIR'
  const time = attendance.checkInTime?.slice(0, 5) ?? '-'
  const sub = dup ? `Tercatat ${STATUS_META[attendance.status].label.toLowerCase()} jam ${time}` : late && mins <= 180 ? `Terlambat ${mins} menit, jam ${time}` : `Jam ${time}`
  return (
    <button onClick={onClose} className={cn('flex h-full w-full flex-col items-center justify-center gap-5 p-6 text-center', tone)}>
      <span className="stamp text-[2.6rem] sm:text-6xl">{stamp}</span>
      <p className="display text-[2.6rem] leading-none text-balance sm:text-6xl">{student.name}</p>
      <p className="text-lg font-semibold">
        Kelas {className}
        {result.subjectName ? `, ${result.subjectName}` : ''}. {sub}.
      </p>
      {otherClass && !dup && (
        <p className="max-w-xs rounded-sm bg-black/25 px-3 py-2 text-base font-semibold">Siswa ini dari kelas {className}, bukan kelas yang sedang Anda ajar. Tetap tercatat.</p>
      )}
    </button>
  )
}

/** Pintu masuk: belum mengambil kelas = pilih kelas dulu. Sudah mengambil = layar memindai. */
export default function ScannerPage() {
  const mine = useLoad(api.getMySession, [])
  if (!mine.data && mine.loading) return <Spinner />
  if (!mine.data) return <TakeClass onStarted={() => void mine.reload()} />
  return <ScanView key={mine.data.id} session={mine.data} onEnded={() => void mine.reload()} />
}

function ScanView({ session, onEnded }: { session: TeachingSession; onEnded: () => void }) {
  const toast = useToast()
  const { data: settings } = useLoad(api.getSettings, [])
  const board = useLoad(() => api.getLessons(session.classId, session.subjectId), [session.classId, session.subjectId])
  const reloadBoard = board.reload

  const [cam, setCam] = useState<CamState>('idle')
  const [camError, setCamError] = useState('')
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [camIndex, setCamIndex] = useState<number | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [sound, setSound] = useState(true)
  const [nis, setNis] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ending, setEnding] = useState(false)
  const [editing, setEditing] = useState<LessonRow | null>(null)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const busyRef = useRef(false)
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const hideTimer = useRef<number | undefined>(undefined)
  const wakeLock = useRef<WakeLockSentinel | null>(null)
  const soundRef = useRef(sound)
  soundRef.current = sound
  const handleRef = useRef<(code: string) => Promise<ScanResult | undefined>>(async () => undefined)

  const handleCode = useCallback(
    async (code: string): Promise<ScanResult | undefined> => {
      const now = Date.now()
      // Kartu yang sama masih di depan kamera: abaikan selama 3 detik
      if (busyRef.current || (code === lastRef.current.code && now - lastRef.current.at < 3000)) return undefined
      busyRef.current = true
      lastRef.current = { code, at: now }
      try {
        const r = await api.scan(code)
        feedback(r.kind, r.kind === 'ok' && r.attendance.status === 'terlambat', soundRef.current)
        setResult(r)
        window.clearTimeout(hideTimer.current)
        hideTimer.current = window.setTimeout(() => setResult(null), r.kind === 'ok' ? 2200 : 3200)
        if (r.kind === 'ok') void reloadBoard(true)
        return r
      } catch (e) {
        // Sesi sudah diakhiri (misal oleh admin): kembali ke daftar kelas
        toast(e instanceof Error ? e.message : 'Gagal memindai', 'error')
        onEnded()
        return undefined
      } finally {
        busyRef.current = false
      }
    },
    [reloadBoard, toast, onEnded],
  )
  handleRef.current = handleCode

  const stop = useCallback(async () => {
    const s = scannerRef.current
    if (s?.isScanning) {
      try {
        await s.stop()
      } catch {
        // sudah berhenti
      }
    }
    wakeLock.current?.release().catch(() => {})
    wakeLock.current = null
    setCam('idle')
  }, [])

  const start = useCallback(
    async (index: number | null = camIndex) => {
      setCamError('')
      setCam('starting')
      try {
        // Membuka suara setelah ketukan pengguna (aturan browser)
        try {
          audioCtx ??= new AudioContext()
          void audioCtx.resume()
        } catch {
          // abaikan
        }
        scannerRef.current ??= new Html5Qrcode('qr-reader', { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false })
        if (scannerRef.current.isScanning) await scannerRef.current.stop()
        const source = index !== null && cameras[index] ? cameras[index]!.id : { facingMode: 'environment' }
        await scannerRef.current.start(
          source,
          {
            fps: 12,
            qrbox: (w, h) => {
              const size = Math.floor(Math.min(w, h) * 0.7)
              return { width: size, height: size }
            },
          },
          (text) => void handleRef.current(text),
          () => {},
        )
        setCam('running')
        if (!cameras.length) Html5Qrcode.getCameras().then(setCameras).catch(() => {})
        try {
          wakeLock.current = await navigator.wakeLock?.request('screen')
        } catch {
          // layar boleh mati sendiri
        }
      } catch (err) {
        setCamError(cameraErrorText(err))
        setCam('error')
      }
    },
    [camIndex, cameras],
  )

  // Daftar "belum dipindai" ikut berubah saat guru lain memindai kelas yang sama
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) void reloadBoard(true)
    }, 4000)
    return () => window.clearInterval(id)
  }, [reloadBoard])

  useEffect(() => {
    return () => {
      const s = scannerRef.current
      if (s?.isScanning) s.stop().catch(() => {})
      wakeLock.current?.release().catch(() => {})
      window.clearTimeout(hideTimer.current)
    }
  }, [])

  function switchCamera() {
    if (cameras.length < 2) return
    const next = ((camIndex ?? 0) + 1) % cameras.length
    setCamIndex(next)
    void start(next)
  }

  /** Hasil absen manual atau foto muncul di bawah layar, jadi tampilkan juga sebagai pesan yang terlihat */
  function announce(r: ScanResult) {
    if (r.kind === 'ok') {
      const late = r.attendance.status === 'terlambat'
      toast(`${r.student.name}, kelas ${r.className}: ${late ? 'Terlambat' : 'Tepat waktu'} jam ${r.attendance.checkInTime?.slice(0, 5)}`)
    } else if (r.kind === 'duplicate') {
      toast(`${r.student.name} sudah absen di pelajaran ini`, 'error')
    } else {
      toast(r.message, 'error')
    }
  }

  async function submitManual(e: FormEvent) {
    e.preventDefault()
    if (!nis.trim()) return
    setManualLoading(true)
    lastRef.current = { code: '', at: 0 }
    const r = await handleCode(nis.trim())
    setManualLoading(false)
    if (r) {
      announce(r)
      setNis('')
    }
  }

  async function scanImage(file: File) {
    try {
      const fileScanner = new Html5Qrcode('qr-file', false)
      const text = await fileScanner.scanFile(file, false)
      lastRef.current = { code: '', at: 0 }
      const r = await handleCode(text)
      if (r) announce(r)
    } catch {
      setResult({ kind: 'invalid', message: 'Tidak ada QR Code yang terbaca di gambar itu. Pastikan foto kartu jelas dan tidak buram.' })
      window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => setResult(null), 3200)
    }
  }

  /** Akhiri pelajaran: yang belum dipindai ditandai tidak hadir, lalu kelas kembali kosong untuk guru berikutnya. */
  async function endLesson() {
    setEnding(true)
    try {
      await stop()
      const r = await api.endSession(session.id)
      toast(`Pelajaran selesai. Kelas ${session.className} kosong.${r.marked ? ` ${r.marked} siswa ditandai tidak hadir.` : ''}${r.bolos ? ` ${r.bolos} di antaranya hadir pagi tadi (bolos).` : ''}`)
      onEnded()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengakhiri pelajaran', 'error')
      setEnding(false)
    }
  }

  const rows = board.data ?? []
  const present = rows.filter((r) => r.lesson && (r.lesson.status === 'hadir' || r.lesson.status === 'terlambat')).length
  const notYet = rows.filter((r) => !r.lesson)
  const recent = rows
    .filter((r) => r.lesson?.checkInTime)
    .sort((a, b) => b.lesson!.updatedAt.localeCompare(a.lesson!.updatedAt))
    .slice(0, 10)

  return (
    <>
      <PageHeader
        title="Scan Presensi"
        subtitle="Pindai kartu siswa satu per satu. Di akhir pelajaran, ketuk Akhiri pelajaran supaya kelas kosong untuk guru berikutnya."
        actions={
          <Button variant="secondary" size="sm" onClick={() => setSound((s) => !s)} icon={sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}>
            Suara {sound ? 'nyala' : 'mati'}
          </Button>
        }
      />

      {/* Status mengajar: kelas ini sedang Anda ajar */}
      <section className="mb-6 border-l-4 border-stabilo bg-brand-900 p-4 text-white">
        <p className="text-sm font-semibold text-brand-200">Anda sedang mengajar</p>
        <p className="display text-[2.2rem] leading-none">
          {session.subjectName}, kelas {session.className}
        </p>
        <p className="mt-1 text-brand-100">Sejak jam {session.startedAt.slice(11, 16)}</p>
        {confirmEnd ? (
          <div className="mt-4">
            <p className="font-bold">Akhiri pelajaran dan keluar dari kelas {session.className}?</p>
            <p className="mt-1 text-brand-100">
              {notYet.length} siswa yang belum dipindai ditandai tidak hadir. Yang sudah hadir pagi tadi terhitung bolos dan terlihat oleh wali kelas. Setelah itu kelas kosong.
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
                Batal
              </Button>
              <Button className="bg-stabilo text-brand-900 hover:bg-stabilo hover:brightness-95" onClick={() => void endLesson()} loading={ending}>
                Ya, akhiri pelajaran
              </Button>
            </div>
          </div>
        ) : (
          <Button className="mt-4 bg-stabilo text-brand-900 hover:bg-stabilo hover:brightness-95" icon={<DoorOpen className="size-5" />} onClick={() => setConfirmEnd(true)}>
            Akhiri pelajaran
          </Button>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* Area kamera */}
          <div className="relative aspect-square overflow-hidden rounded-md bg-brand-900 sm:aspect-[4/3] lg:aspect-square">
            <div id="qr-reader" className="absolute inset-0 [&_video]:h-full! [&_video]:w-full!" />
            <div id="qr-file" className="hidden" />

            {!result && (
              <div className="pointer-events-none absolute inset-5 z-[5]">
                {['top-0 left-0 border-t-4 border-l-4', 'top-0 right-0 border-t-4 border-r-4', 'bottom-0 left-0 border-b-4 border-l-4', 'bottom-0 right-0 border-b-4 border-r-4'].map((c) => (
                  <span key={c} className={`absolute size-9 border-stabilo ${c}`} />
                ))}
              </div>
            )}

            {cam !== 'running' && !result && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                {cam === 'error' ? (
                  <>
                    <p className="max-w-sm text-base text-slate-200">{camError}</p>
                    <Button size="lg" onClick={() => void start()} icon={<RefreshCcw className="size-5" />}>
                      Coba lagi
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="display text-4xl text-white">Siap memindai</p>
                      <p className="mt-2 text-brand-200">Ketuk tombol di bawah, lalu izinkan kamera bila diminta.</p>
                    </div>
                    <Button size="lg" variant="secondary" onClick={() => void start()} loading={cam === 'starting'} icon={<Camera className="size-6" />}>
                      Nyalakan Kamera
                    </Button>
                  </>
                )}
              </div>
            )}

            {cam === 'running' && !result && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/65 px-5 py-3 text-center font-semibold text-white">
                Dekatkan kartu ke dalam kotak sampai berbunyi
              </div>
            )}

            {result && (
              <div className="absolute inset-0 z-10">
                <ResultPanel result={result} settings={settings} otherClass={'student' in result && result.student.classId !== session.classId} onClose={() => setResult(null)} />
              </div>
            )}
          </div>

          {cam === 'running' && (
            <div className="flex gap-2">
              {cameras.length > 1 && (
                <Button variant="secondary" className="flex-1" onClick={switchCamera} icon={<SwitchCamera className="size-4" />}>
                  Ganti kamera
                </Button>
              )}
              <Button variant="secondary" className="flex-1" onClick={() => void stop()} icon={<CameraOff className="size-4" />}>
                Matikan kamera
              </Button>
            </div>
          )}

          {/* Cadangan bila kartu rusak atau kamera bermasalah */}
          <Card className="p-4">
            <form onSubmit={submitManual}>
              <label htmlFor="nis" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Keyboard className="size-4 text-slate-400" /> Kartu rusak atau hilang? Ketik NIS siswa
              </label>
              <div className="flex gap-2">
                <Input id="nis" inputMode="numeric" value={nis} onChange={(e) => setNis(e.target.value)} placeholder="contoh: 20250001" className="py-3 text-base" />
                <Button type="submit" size="lg" loading={manualLoading} disabled={!nis.trim()}>
                  Absen
                </Button>
              </div>
            </form>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700">
              <ImageUp className="size-4" /> Atau pilih foto kartu QR dari galeri
              <input
                id="qr-image"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void scanImage(f)
                  e.target.value = ''
                }}
              />
            </label>
          </Card>
        </div>

        <div className="min-w-0 space-y-8">
          {/* Perkembangan kelas: siapa yang sudah dan belum dipindai */}
          <section>
            <div className="flex items-end justify-between gap-3">
              <h2 className="display text-[1.9rem] text-brand-900">Kelas {session.className}</h2>
              <p className="display text-[2.4rem] leading-none text-brand-900">
                <span className="stabilo">{present}</span>
                <span className="text-slate-400">/{rows.length}</span>
              </p>
            </div>
            <p className="mt-1 mb-3 text-slate-600">{notYet.length === 0 && rows.length ? 'Semua siswa sudah tercatat.' : 'hadir. Kotak terisi saat kartu dipindai. Nama yang belum dipindai tampil di bawah.'}</p>
            <Cells size="lg" cells={rows.map((r) => (r.lesson ? r.lesson.status : null))} />
            {notYet.length > 0 && (
              <div className="mt-5">
                <h3 className="font-bold text-slate-900">Belum dipindai ({notYet.length})</h3>
                <p className="mb-2 text-sm text-slate-500">Ketuk nama untuk menandai izin, sakit, atau hadir tanpa kartu.</p>
                <ul className="flex flex-wrap gap-x-2 gap-y-1.5">
                  {notYet.map((r) => (
                    <li key={r.student.id}>
                      <button onClick={() => setEditing(r)} className="min-h-9 rounded-sm bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-brand-50 hover:ring-brand-500">
                        {r.student.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section>
            <h2 className="display text-[1.9rem] text-brand-900">Dipindai terakhir</h2>
            <p className="mb-2 text-sm text-slate-500">Salah memindai? Ketuk nama untuk mengoreksi.</p>
            {recent.length ? (
              <ul className="border-t border-slate-300">
                {recent.map((r, i) => (
                  <li key={r.student.id} className={cn('border-b border-slate-200', i === 0 && 'bg-white')}>
                    <button onClick={() => setEditing(r)} className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left hover:bg-white" title="Ketuk untuk mengoreksi">
                      <span className="display w-14 shrink-0 text-xl text-brand-900">{r.lesson!.checkInTime?.slice(0, 5)}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{r.student.name}</span>
                      <span className="shrink-0 text-sm text-slate-500">{r.student.className}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border-t border-slate-300 pt-4">
                <Illustration name="kosong-absen" className="mb-3 h-28 object-contain object-left" />
                <p className="font-semibold text-slate-700">Belum ada yang dipindai</p>
                <p className="mt-1 text-sm text-slate-500">Nama siswa akan muncul di sini setiap kali kartunya di-scan.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <LessonStatusModal row={editing} session={session} onClose={() => setEditing(null)} onSaved={() => void reloadBoard(true)} />
    </>
  )
}
