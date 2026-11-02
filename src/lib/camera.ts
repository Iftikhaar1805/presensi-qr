import { Html5Qrcode } from 'html5-qrcode'

/**
 * Pengaturan pemindai untuk halaman scan guru dan halaman Cek Kartu siswa.
 * - Tanpa qrbox: seluruh gambar kamera dibaca, jadi kartu tidak perlu tepat di tengah.
 * - Pembaca QR bawaan browser (BarcodeDetector) dipakai bila ada: jauh lebih cepat dan akurat di HP.
 */
export const scanConfig = {
  fps: 12,
  disableFlip: true,
  experimentalFeatures: { useBarCodeDetectorIfSupported: true },
}

type Source = string | { facingMode: 'environment' | 'user' }

/** Resolusi lebih tinggi dan fokus otomatis terus-menerus, supaya QR di layar atau kartu terbaca tajam. */
function constraintsFor(source: Source): MediaTrackConstraints {
  const base = { width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: 'continuous' }] } as unknown as MediaTrackConstraints
  return typeof source === 'string' ? { ...base, deviceId: { exact: source } } : { ...base, facingMode: { ideal: source.facingMode } }
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Menghentikan kamera dan membersihkan tampilan pemindai sampai benar-benar lepas. Aman dipanggil berulang. */
export async function releaseScanner(scanner: Html5Qrcode | null): Promise<void> {
  if (!scanner) return
  try {
    if (scanner.isScanning) await scanner.stop()
  } catch {
    // sudah berhenti
  }
  try {
    scanner.clear()
  } catch {
    // tidak ada yang perlu dibersihkan
  }
}

/**
 * Menyalakan kamera dengan beberapa cara berurutan, karena perangkat berbeda-beda:
 * 1. kamera yang dipilih (bila ada), 2. kamera belakang, 3. setiap kamera yang terdaftar (belakang lebih dulu), 4. kamera depan.
 * Bila gagal bukan karena izin (kamera masih tertahan sesi sebelumnya, dsb.), seluruh urutan diulang sekali setelah jeda singkat.
 * Izin yang ditolak langsung dilaporkan, tidak dicoba ulang.
 */
export async function startCamera(scanner: Html5Qrcode, onDecode: (text: string) => void, preferredId?: string): Promise<void> {
  const noop = () => {}
  let last: unknown
  const attempt = async (source: Source) => {
    try {
      await scanner.start(source, { ...scanConfig, videoConstraints: constraintsFor(source) }, onDecode, noop)
      return true
    } catch (e) {
      last = e
      if (isPermissionError(e)) throw e
      // setelah gagal, pastikan tidak ada sisa aliran yang menahan kamera
      try {
        if (scanner.isScanning) await scanner.stop()
      } catch {
        // abaikan
      }
      return false
    }
  }

  const round = async (): Promise<boolean> => {
    if (preferredId && (await attempt(preferredId))) return true
    if (await attempt({ facingMode: 'environment' })) return true
    try {
      const cams = await Html5Qrcode.getCameras()
      const back = /back|rear|belakang|environment|world/i
      const ordered = [...cams].sort((a, b) => Number(back.test(b.label)) - Number(back.test(a.label)))
      for (const cam of ordered) if (await attempt(cam.id)) return true
    } catch (e) {
      last = e
      if (isPermissionError(e)) throw e
    }
    return attempt({ facingMode: 'user' })
  }

  if (await round()) return
  await sleep(700)
  if (await round()) return
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
