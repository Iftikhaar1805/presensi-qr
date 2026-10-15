'use client'

import dynamic from 'next/dynamic'

// Pemindai kamera memakai API browser, jadi hanya dimuat di sisi klien.
const CekKartuPage = dynamic(() => import('../../src/views/CekKartuPage'), { ssr: false })

export default function Page() {
  return <CekKartuPage />
}
