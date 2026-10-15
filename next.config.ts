import type { NextConfig } from 'next'

const config: NextConfig = {
  poweredByHeader: false,
  // Akar proyek ini sendiri (ada package-lock.json lain di folder pengguna yang tidak boleh ikut terbaca).
  turbopack: { root: process.cwd() },
  // Driver database berisi modul native, jadi tidak ikut digabung ke bundel.
  serverExternalPackages: ['@libsql/client', 'libsql'],
  async headers() {
    const aman = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      // Kamera hanya untuk halaman ini sendiri; mikrofon dan lokasi tidak dipakai
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
    ]
    return [
      { source: '/:path*', headers: aman },
      // Data presensi selalu terbaru: jangan disimpan browser atau perantara
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default config
