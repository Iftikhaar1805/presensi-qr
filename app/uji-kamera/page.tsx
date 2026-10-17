'use client'

import dynamic from 'next/dynamic'

// Memakai API kamera browser, jadi hanya dimuat di sisi klien.
const UjiKameraPage = dynamic(() => import('../../src/views/UjiKameraPage'), { ssr: false })

export default function Page() {
  return <UjiKameraPage />
}
