import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

/** Muat data async dari api.ts; `reload()` untuk memuat ulang setelah simpan/hapus. */
export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const reqId = useRef(0)

  const reload = useCallback(async (silent = false) => {
    const id = ++reqId.current
    if (!silent) setLoading(true)
    setError(null)
    try {
      const result = await fnRef.current()
      if (id === reqId.current) setData(result)
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, reload }
}
