import { Html5Qrcode } from 'html5-qrcode'

/** Pengaturan pemindai yang dipakai halaman scan guru dan halaman Cek Kartu siswa. */
export const scanConfig = {
  fps: 10,
  qrbox: (w: number, h: number) => {
    const size = Math.floor(Math.min(w, h) * 0.7)
    return { width: size, height: size }
  },
}

function errName(err: unknown): string {
  return err instanceof Error ? err.name : ''
}

function errText(err: unknown): string {
  return String(err instanceof Error ? err.message : err)
}

export function isPermissionError(err: unknown): boolean {
  return /NotAllowed|Permission|denied/i.test(errName(err) + ' ' + errText(err))
}

/**
 * Menyalakan kamera dengan beberapa cara berurutan, karena perangkat berbeda-beda:
 * 1. kamera yang dipilih (bila ada), 2. kamera belakang, 3. setiap kamera yang terdaftar (belakang lebih dulu), 4. kamera depan.
 * Izin yang ditolak langsung dilaporkan, tidak dicoba ulang.
 */
export async function startCamera(scanner: Html5Qrcode, onDecode: (text: string) => void, preferredId?: string): Promise<void> {
  const noop = () => {}
  let last: unknown
  const attempt = async (source: string | MediaTrackConstraints) => {
    try {
      await scanner.start(source, scanConfig, onDecode, noop)
      return true
    } catch (e) {
      last = e
      if (isPermissionError(e)) throw e
      return false
    }
  }

  if (preferredId && (await attempt(preferredId))) return
  if (await attempt({ facingMode: 'environment' })) return

  try {
    const cams = await Html5Qrcode.getCameras()
    const back = /back|rear|belakang|environment|world/i
    const ordered = [...cams].sort((a, b) => Number(back.test(b.label)) - Number(back.test(a.label)))
    for (const cam of ordered) if (await attempt(cam.id)) return
  } catch (e) {
    last = e
    if (isPermissionError(e)) throw e
  }

  if (await attempt({ facingMode: 'user' })) return
  throw last ?? new Error('Kamera tidak bisa dinyalakan')
}

/** Pesan untuk pengguna dalam bahasa sehari-hari, ditambah detail teknis supaya penyebab pasti bisa dicari. */
export function cameraErrorText(err: unknown): string {
  const detail = `${errName(err) || 'Error'}: ${errText(err)}`.slice(0, 140)
  let text: string
  if (!window.isSecureContext) text = 'Kamera hanya bisa dipakai lewat alamat https://. Buka aplikasi dari alamat https, atau pakai Ketik NIS di bawah.'
  else if (isPermissionError(err)) text = 'Izin kamera ditolak. Ketuk ikon gembok atau aA di samping alamat web, pilih Kamera lalu Izinkan, kemudian muat ulang halaman.'
  else if (/NotFound|no camera|Requested device not found|DevicesNotFound/i.test(errName(err) + errText(err))) text = 'Kamera tidak ditemukan di perangkat ini. Pakai Ketik NIS di bawah.'
  else if (/NotReadable|in use|TrackStart|Could not start/i.test(errName(err) + errText(err))) text = 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera, video call, atau WhatsApp, lalu coba lagi.'
  else text = 'Kamera gagal dinyalakan. Muat ulang halaman, atau pakai Ketik NIS di bawah.'
  return `${text} (Detail teknis: ${detail})`
}
