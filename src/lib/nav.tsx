'use client'

// Penghubung tipis antara tampilan dan router Next.js, supaya halaman memakai nama yang sama
// (Link, NavLink, Navigate, useNavigate, useLocation, useSearchParams) tanpa bergantung pada detail router.
import NextLink from 'next/link'
import { usePathname, useRouter, useSearchParams as useNextSearchParams } from 'next/navigation'
import { useEffect, useMemo, type AnchorHTMLAttributes, type ReactNode } from 'react'

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'>

export function Link({ to, replace, className, children, ...rest }: AnchorProps & { to: string; replace?: boolean; className?: string; children?: ReactNode }) {
  return (
    <NextLink href={to} replace={replace} className={className} {...rest}>
      {children}
    </NextLink>
  )
}

type ActiveState = { isActive: boolean }

/** Seperti Link, tetapi className dan children boleh berupa fungsi yang menerima { isActive }. */
export function NavLink({
  to,
  className,
  children,
  ...rest
}: AnchorProps & { to: string; className?: string | ((s: ActiveState) => string); children?: ReactNode | ((s: ActiveState) => ReactNode) }) {
  const pathname = usePathname()
  const isActive = pathname === to || pathname.startsWith(`${to}/`)
  return (
    <NextLink href={to} className={typeof className === 'function' ? className({ isActive }) : className} aria-current={isActive ? 'page' : undefined} {...rest}>
      {typeof children === 'function' ? children({ isActive }) : children}
    </NextLink>
  )
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (replace) router.replace(to)
    else router.push(to)
  }, [router, to, replace])
  return null
}

export function useNavigate() {
  const router = useRouter()
  return (to: string, opts?: { replace?: boolean }) => (opts?.replace ? router.replace(to) : router.push(to))
}

export function useLocation() {
  return { pathname: usePathname() }
}

/** Bentuknya sama dengan useSearchParams di React Router: [params yang boleh diubah, fungsi untuk menyimpannya ke alamat]. */
export function useSearchParams() {
  const current = useNextSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const params = useMemo(() => new URLSearchParams(current.toString()), [current])
  const setParams = (next: URLSearchParams, opts?: { replace?: boolean }) => {
    const url = `${pathname}${next.toString() ? `?${next}` : ''}`
    if (opts?.replace) router.replace(url)
    else router.push(url)
  }
  return [params, setParams] as const
}
