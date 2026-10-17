'use client'

import { Camera, CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui'

type Line = { ok: boolean; label: string; value: string }

/**
 * Halaman uji kamera tanpa pemindai: meminta kamera langsung ke browser dan melaporkan tiap langkah.
 * Dipakai untuk mencari tahu kenapa kamera tidak menyala di sebuah HP (izin, browser, atau perangkat).
 */
export default function UjiKameraPage() {
  const [lines, setLines] = useState<Line[]>([])
  const [running, setRunning] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  async function run() {
    setRunning(true)
    setStreaming(false)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    const out: Line[] = []
    const add = (ok: boolean, label: string, value: string) => {
      out.push({ ok, label, value })
      setLines([...out])
    }
    add(true, 'Alamat halaman', location.href.slice(0, 60))
    add(window.isSecureContext, 'Alamat aman (https)', window.isSecureContext ? 'Ya' : 'TIDAK. Kamera diblokir di alamat http. Buka alamat https://.')
    add(true, 'Browser', navigator.userAgent.slice(0, 110))
    const hasCam = typeof navigator.mediaDevices?.getUserMedia === 'function'
    add(hasCam, 'Browser mendukung kamera', hasCam ? 'Ya' : 'TIDAK. Browser ini tidak bisa memakai kamera. Pakai Chrome atau Safari langsung.')
    if (!hasCam) {
      setRunning(false)
      return
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cams = devices.filter((d) => d.kind === 'videoinput')
      add(cams.length > 0, 'Jumlah kamera terdeteksi', cams.length ? `${cams.length}${cams.some((c) => c.label) ? ': ' + cams.map((c) => c.label).join(', ').slice(0, 90) : ''}` : '0. Perangkat tidak melaporkan kamera.')
    } catch (e) {
      add(false, 'Daftar kamera', String(e))
    }

    const attempts: [string, MediaStreamConstraints][] = [
      ['kamera belakang', { video: { facingMode: 'environment' } }],
      ['kamera apa saja', { video: true }],
    ]
    for (const [name, constraints] of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        const track = stream.getVideoTracks()[0]
        const s = track?.getSettings()
        add(true, `Izin dan ${name}`, `BERHASIL${s?.width ? `, ${s.width}x${s.height}` : ''}${track?.label ? `, ${track.label}` : ''}`)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch((e) => add(false, 'Memutar gambar', String(e)))
          setStreaming(true)
        }
        add(true, 'Kesimpulan', 'Kamera di perangkat dan browser ini BERFUNGSI. Jika pemindai di aplikasi tetap gagal, kirim hasil halaman ini ke pembuat aplikasi.')
        setRunning(false)
        return
      } catch (e) {
        const err = e as Error
        add(false, `Mencoba ${name}`, `${err.name}: ${err.message}`.slice(0, 140))
        if (/NotAllowed|Permission|denied/i.test(err.name + err.message)) {
          add(false, 'Kesimpulan', 'IZIN KAMERA DITOLAK. Android Chrome: ikon gembok di samping alamat, Izin, Kamera, Izinkan. iPhone Safari: aA di kiri alamat, Pengaturan Situs Web, Kamera, Izinkan. Lalu muat ulang halaman ini.')
          setRunning(false)
          return
        }
      }
    }
    add(false, 'Kesimpulan', 'Kamera tidak bisa dibuka. Tutup aplikasi lain yang memakai kamera, buka lewat Chrome atau Safari langsung (bukan dari dalam WhatsApp), lalu coba lagi.')
    setRunning(false)
  }

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-md">
        <h1 className="display text-[2.4rem] leading-none text-brand-900">Uji Kamera</h1>
        <p className="mt-2 text-lg text-slate-700">Ketuk tombol di bawah. Jika browser meminta izin kamera, pilih Izinkan. Hasilnya tampil di bawah, lalu kirim tangkapan layarnya.</p>
        <Button size="lg" className="mt-5 w-full" onClick={() => void run()} loading={running} icon={<Camera className="size-5" />}>
          Tes kamera sekarang
        </Button>
        <video ref={videoRef} playsInline muted autoPlay className={streaming ? 'mt-4 aspect-square w-full rounded-md bg-brand-900 object-cover' : 'hidden'} />
        <ul className="mt-5 space-y-2">
          {lines.map((l, i) => (
            <li key={i} className={`flex gap-2 rounded-md p-3 ring-1 ${l.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
              {l.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-ink-red" />}
              <p className="min-w-0 break-words">
                <span className="block font-bold text-slate-900">{l.label}</span>
                <span className="text-slate-700">{l.value}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
