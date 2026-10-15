'use client'

import dynamic from 'next/dynamic'
import Only from '../../../src/components/Only'
import { Spinner } from '../../../src/components/ui'

// Pemindai kamera memakai API browser, jadi hanya dimuat di sisi klien.
const ScannerPage = dynamic(() => import('../../../src/views/ScannerPage'), { ssr: false, loading: () => <Spinner /> })

export default function Page() {
  return (
    <Only roles={['admin', 'guru']}>
      <ScannerPage />
    </Only>
  )
}
