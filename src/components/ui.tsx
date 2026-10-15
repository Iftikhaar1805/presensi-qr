'use client'

import { Loader2, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import type { Status } from '../lib/types'
import { STATUS_META, cn } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-900',
  secondary: 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-200/60',
  danger: 'bg-ink-red text-white hover:brightness-90',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' && 'min-h-9 px-3 text-sm',
        size === 'md' && 'min-h-11 px-4 text-[0.95rem]',
        size === 'lg' && 'min-h-14 px-6 text-lg',
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

/** Panel datar dengan garis tipis, tanpa bayangan. Pakai seperlunya. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-md border border-slate-200 bg-white', className)}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="no-print mb-6 flex flex-col gap-3 border-b-2 border-brand-900 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="display text-[2.5rem] leading-none text-brand-900 sm:text-[3.1rem]">{title}</h1>
        {subtitle && <p className="mt-2.5 max-w-prose text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Status ditandai huruf dalam kotak, seperti kolom H/S/I/A di buku absen. */
export function Mark({ status, size = 'md' }: { status: Status; size?: 'sm' | 'md' }) {
  const m = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-sm border-[1.5px] font-extrabold',
        size === 'md' ? 'size-6 text-xs' : 'size-5 text-[0.65rem]',
        m.text,
        m.border,
      )}
    >
      {m.short}
    </span>
  )
}

export function StatusBadge({ status, className }: { status: Status | null; className?: string }) {
  if (!status) return <span className={cn('text-sm font-medium text-slate-400', className)}>Belum datang</span>
  const m = STATUS_META[status]
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm font-bold', m.text, className)}>
      <Mark status={status} size="sm" />
      {m.label}
    </span>
  )
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-semibold text-slate-800">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-sm text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-sm font-semibold text-ink-red">{error}</span>}
    </label>
  )
}

const inputCls =
  'w-full min-h-11 rounded-md border-0 bg-white px-3.5 py-2 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-slate-100'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(inputCls, className)} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(inputCls, 'pr-9', className)}>
      {children}
    </select>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-lg bg-white sm:rounded-lg', size === 'md' ? 'sm:max-w-md' : 'sm:max-w-2xl')}
      >
        <div className="flex items-center justify-between border-b-2 border-brand-900 px-5 py-3.5">
          <h2 className="display text-2xl text-brand-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Hapus',
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-slate-700">{message}</p>
    </Modal>
  )
}

export function EmptyState({ title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-lg font-bold text-slate-800">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-slate-500">{children}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-16 text-slate-400', className)}>
      <Loader2 className="size-6 animate-spin" />
    </div>
  )
}
