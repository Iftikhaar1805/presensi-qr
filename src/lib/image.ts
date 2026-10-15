/**
 * Mengecilkan gambar logo di browser sebelum diunggah: sisi terpanjang 256 px.
 * Hasilnya data URL kecil sehingga tersimpan di database dan ikut jalan di hosting gratis.
 */
export async function fileToLogoDataUrl(file: File, max = 256): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Pilih berkas gambar (PNG, JPG, atau WebP).')
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new Error('Gambar tidak bisa dibuka. Coba berkas PNG atau JPG lain.')
  }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * scale))
  canvas.height = Math.max(1, Math.round(bmp.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Browser tidak bisa memproses gambar.')
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const png = canvas.toDataURL('image/png')
  return png.length <= 240_000 ? png : canvas.toDataURL('image/webp', 0.85)
}
