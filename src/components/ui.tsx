import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/* ---------------------------------------------------------------- button */

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'dark'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-copper text-bone hover:bg-copper-2 shadow-[0_6px_18px_-6px_rgba(180,113,58,0.7)] hover:shadow-[0_10px_24px_-8px_rgba(180,113,58,0.85)]',
  dark: 'bg-espresso text-bone hover:bg-espresso-2 shadow-[0_6px_18px_-8px_rgba(30,21,16,0.8)]',
  outline: 'bg-card text-ink border border-line-2 hover:border-copper hover:text-copper',
  ghost: 'bg-transparent text-ink-2 hover:bg-bone-2 hover:text-ink',
  danger: 'bg-clay/10 text-clay border border-clay/25 hover:bg-clay hover:text-bone',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: {
  children: ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizes = {
    sm: 'h-9 px-4 text-[13px]',
    md: 'h-11 px-6 text-sm',
    lg: 'h-12 px-8 text-[15px]',
  }
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight
        transition-all duration-200 ease-out active:scale-[0.97]
        disabled:opacity-40 disabled:pointer-events-none
        ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

/* ----------------------------------------------------------------- input */

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  )
}

const inputBase =
  'w-full rounded-xl2 border border-line bg-card px-3.5 py-2.5 text-[14px] text-ink outline-none ' +
  'transition-all duration-200 placeholder:text-muted/60 ' +
  'focus:border-copper focus:ring-4 focus:ring-copper/12 hover:border-line-2'

export function Input({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${inputBase} ${className}`} />
}

export function TextArea({
  className = '',
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`${inputBase} resize-none leading-relaxed ${className}`} />
}

export function Select({
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${inputBase} cursor-pointer appearance-none pr-9 ${className}`}>
      {children}
    </select>
  )
}

/* ------------------------------------------------------------------ card */

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-[22px] border border-line bg-card shadow-[0_2px_14px_-8px_rgba(42,32,24,0.25)] ${className}`}
    >
      {children}
    </section>
  )
}

export function CardHead({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
      <div>
        <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p> : null}
      </div>
      {right}
    </header>
  )
}

/* ----------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'max-w-2xl',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // Portalled to <body>: the page-entry animation leaves an identity transform
  // on its wrapper, which would otherwise make `position: fixed` resolve
  // against the content column instead of the viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="anim-fade fixed inset-0 bg-espresso/55 backdrop-blur-[3px]" onClick={onClose} />
      <div
        className={`anim-pop relative z-10 w-full ${width} my-auto rounded-[20px] border border-line bg-card shadow-[0_30px_80px_-20px_rgba(30,21,16,0.55)] sm:rounded-[24px]`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <h3 className="font-display text-[21px] font-semibold leading-tight text-ink">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-bone-2 hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className="px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------------------------------------------------------------- pieces */

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'copper' | 'sage' | 'clay'
}) {
  const tones = {
    neutral: 'bg-bone-2 text-ink-2',
    copper: 'bg-copper-soft text-copper',
    sage: 'bg-sage/12 text-sage',
    clay: 'bg-clay/12 text-clay',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.07em] ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function Empty({ title, note }: { title: string; note?: string }) {
  return (
    <div className="anim-fade grid place-items-center px-6 py-16 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-bone-2">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-muted">
          <path
            d="M4 7h16M4 12h16M4 17h10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="font-display text-[17px] font-semibold text-ink">{title}</p>
      {note ? <p className="mt-1 max-w-sm text-[13px] text-muted">{note}</p> : null}
    </div>
  )
}
