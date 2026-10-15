import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import Providers from '../src/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Presensi QR — SMP Dharma Bakti',
  description: 'Presensi QR Code di dalam kelas untuk SMP Dharma Bakti (PKM Universitas Pamulang).',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Presensi QR', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0c1744',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;600;700;800&family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div id="root">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  )
}
