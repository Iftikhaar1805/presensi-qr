'use client'

import { useState } from 'react'

/** Ilustrasi WebP dari public/img/. Jika file belum ada, tidak menampilkan apa pun. */
export default function Illustration({ name, className }: { name: string; className?: string }) {
  const [ok, setOk] = useState(true)
  if (!ok) return null
  return <img src={`/img/${name}.webp`} alt="" aria-hidden="true" className={`mix-blend-multiply ${className ?? ''}`} onError={() => setOk(false)} />
}
