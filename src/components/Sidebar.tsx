import type { ReactNode } from 'react'
import { SELLER } from '../lib/seller'

export type Page = 'billing' | 'repeat' | 'invoices' | 'products' | 'companies' | 'settings'

const Icon = {
  billing: (
    <path
      d="M5 3h14v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h3"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  repeat: (
    <path
      d="M4 9a8 8 0 0113.7-5.7L20 5.5M20 15a8 8 0 01-13.7 5.7L4 18.5M20 3.5v4h-4M4 20.5v-4h4"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  invoices: (
    <path
      d="M7 3h7l5 5v13H7V3zM14 3v5h5M10 13h7M10 17h5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  products: (
    <path
      d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  companies: (
    <path
      d="M4 21V6l7-3v18M11 21h9V10l-9-3M14 11h3M14 14h3M14 17h3M7 10h1M7 13h1M7 16h1"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  settings: (
    <path
      d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007.5 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 13.9H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 7.5l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8v.1a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
} satisfies Record<Page, ReactNode>

export const PAGE_TITLES: Record<Page, string> = {
  billing: 'New Bill',
  repeat: 'Repeat Bill',
  invoices: 'Invoices',
  products: 'Products',
  companies: 'Companies',
  settings: 'Settings',
}

const NAV: { key: Page; label: string; note: string }[] = [
  { key: 'billing', label: 'New Bill', note: 'Build & print' },
  { key: 'repeat', label: 'Repeat Bill', note: 'Sell again' },
  { key: 'invoices', label: 'Invoices', note: 'Saved bills' },
  { key: 'products', label: 'Products', note: 'Catalogue' },
  { key: 'companies', label: 'Companies', note: 'Buyers' },
  { key: 'settings', label: 'Settings', note: 'Data & firm' },
]

export default function Sidebar({
  page,
  onNavigate,
  invoiceCount,
  account,
  onSignOut,
}: {
  page: Page
  onNavigate: (p: Page) => void
  invoiceCount: number
  /** null when the app runs on browser storage and nobody signs in */
  account?: { email: string } | null
  onSignOut?: () => void
}) {
  return (
    <aside className="scroll-thin flex w-[246px] shrink-0 flex-col overflow-y-auto bg-espresso text-bone/70">
      <div className="px-6 pb-7 pt-7">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-copper font-display text-[17px] font-bold text-espresso">
            NA
          </div>
          <div className="leading-tight">
            <div className="font-display text-[17px] font-semibold tracking-tight text-bone">
              Naveen Airtech
            </div>
            <div className="text-[11px] tracking-wide text-bone/45">Billing Counter</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 px-3.5">
        {NAV.map((n) => {
          const active = page === n.key
          return (
            <button
              key={n.key}
              onClick={() => onNavigate(n.key)}
              className={`group relative flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left
                transition-all duration-200 ease-out
                ${
                  active
                    ? 'bg-copper text-espresso shadow-[0_10px_24px_-12px_rgba(210,145,79,0.9)]'
                    : 'text-bone/65 hover:bg-espresso-2 hover:text-bone'
                }`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className={`shrink-0 transition-transform duration-300 ${
                  active ? '' : 'group-hover:scale-110'
                }`}
              >
                {Icon[n.key]}
              </svg>
              <span className="flex-1">
                <span className="block text-[14px] font-bold tracking-tight">{n.label}</span>
                <span
                  className={`block text-[11px] ${active ? 'text-espresso/60' : 'text-bone/35'}`}
                >
                  {n.note}
                </span>
              </span>
              {n.key === 'invoices' && invoiceCount > 0 ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    active ? 'bg-espresso/15 text-espresso' : 'bg-espresso-3 text-bone/70'
                  }`}
                >
                  {invoiceCount}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="mx-3.5 mb-5 mt-6 rounded-2xl bg-espresso-2 px-4 py-3.5">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-bone/35">
          GSTIN
        </div>
        <div className="mt-0.5 font-mono text-[12px] tracking-tight text-bone/80">
          {SELLER.gstin.replace('GSTIN: ', '')}
        </div>
        <div className="mt-2 text-[11px] leading-snug text-bone/35">
          Chengalpattu · Tamil Nadu
        </div>
      </div>

      {account ? (
        <div className="mx-3.5 mb-5 flex items-center gap-2.5 border-t border-bone/10 px-1 pt-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-espresso-3 text-[12px] font-bold uppercase text-copper-2">
            {account.email.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-bone/70">{account.email}</div>
            <div className="text-[10.5px] text-bone/35">Signed in</div>
          </div>
          <button
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-bone/40 transition-colors hover:bg-espresso-2 hover:text-bone"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 00-2 2v14a2 2 0 002 2h6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ) : null}
    </aside>
  )
}
