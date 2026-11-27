import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Sidebar, { PAGE_TITLES, type Page } from './Sidebar'

/**
 * Phone and tablet navigation. The counter is used on a phone more than a
 * desktop, so below `lg` the sidebar becomes a top bar plus a slide-in drawer,
 * and the whole width goes to the bill.
 */

export function MobileBar({
  page,
  onMenu,
}: {
  page: Page
  onMenu: () => void
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-card/95 px-4 backdrop-blur lg:hidden">
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="-ml-1.5 grid h-10 w-10 place-items-center rounded-full text-ink-2 transition-colors active:bg-bone-2"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[17px] font-semibold leading-tight text-ink">
          {PAGE_TITLES[page]}
        </div>
      </div>

      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-copper font-display text-[13px] font-bold text-espresso">
        NA
      </div>
    </header>
  )
}

export function MobileDrawer({
  open,
  page,
  onNavigate,
  onClose,
  invoiceCount,
  account,
  onSignOut,
}: {
  open: boolean
  page: Page
  onNavigate: (p: Page) => void
  onClose: () => void
  invoiceCount: number
  account?: { email: string } | null
  onSignOut?: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="anim-fade absolute inset-0 bg-espresso/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="anim-slide absolute inset-y-0 left-0 flex max-w-[86%] shadow-[0_0_60px_rgba(30,21,16,0.5)]">
        <Sidebar
          page={page}
          onNavigate={(p) => {
            onNavigate(p)
            onClose()
          }}
          invoiceCount={invoiceCount}
          account={account}
          onSignOut={onSignOut}
        />
      </div>
    </div>,
    document.body,
  )
}
