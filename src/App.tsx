import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  Company,
  Invoice,
  InvoiceItem,
  InvoiceMeta,
  Product,
  Seller,
  TaxMode,
} from './lib/types'
import { calcInvoice } from './lib/gst'
import { SELLER } from './lib/seller'
import { todayDotted } from './lib/format'
import { authEnabled, currentAccount, onAuthChange, signOut, type Account } from './lib/auth'
import { ensureSeeded, getSeller, listCompanies, listInvoices, listProducts, newId } from './lib/store'
import Sidebar, { type Page } from './components/Sidebar'
import { MobileBar, MobileDrawer } from './components/MobileNav'
import SignIn from './components/SignIn'
import InvoiceDocument from './components/InvoiceDocument'
import { Button } from './components/ui'
import BillingPage from './pages/BillingPage'
import RepeatPage from './pages/RepeatPage'
import InvoicesPage from './pages/InvoicesPage'
import ProductsPage from './pages/ProductsPage'
import CompaniesPage from './pages/CompaniesPage'
import SettingsPage from './pages/SettingsPage'

interface PrintPayload {
  meta: InvoiceMeta
  buyer: Company | null
  items: InvoiceItem[]
  taxMode: TaxMode
}

type DraftMode = 'new' | 'edit' | 'repeat'

/**
 * Copies an old bill into a brand-new one: fresh id and line ids so saving
 * files a second invoice instead of overwriting the original. The invoice
 * number is cleared because they always type their own, and the date defaults
 * to today — both still editable by hand.
 */
const asRepeat = (inv: Invoice): Invoice => ({
  ...inv,
  id: newId('inv'),
  createdAt: new Date().toISOString(),
  meta: { ...inv.meta, invoiceNo: '', dated: todayDotted() },
  items: inv.items.map((i) => ({ ...i, lineId: newId('l') })),
})

export default function App() {
  const [account, setAccount] = useState<Account | null>(null)
  const [authChecked, setAuthChecked] = useState(!authEnabled)

  const [page, setPage] = useState<Page>('billing')
  const [navOpen, setNavOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [seller, setSeller] = useState<Seller>(SELLER)
  const [draft, setDraft] = useState<Invoice | null>(null)
  const [draftMode, setDraftMode] = useState<DraftMode>('new')
  const [billingKey, setBillingKey] = useState(0)
  const [printPayload, setPrintPayload] = useState<PrintPayload | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refreshProducts = useCallback(() => void listProducts().then(setProducts), [])
  const refreshCompanies = useCallback(() => void listCompanies().then(setCompanies), [])
  const refreshInvoices = useCallback(() => void listInvoices().then(setInvoices), [])

  /* ------------------------------------------------------------- session */

  useEffect(() => {
    if (!authEnabled) return
    void currentAccount().then((a) => {
      setAccount(a)
      setAuthChecked(true)
    })
    return onAuthChange((a) => {
      setAccount(a)
      setAuthChecked(true)
      if (!a) {
        // Signed out — drop everything that was loaded for that session.
        setReady(false)
        setLoadError(null)
        setProducts([])
        setCompanies([])
        setInvoices([])
        setDraft(null)
        setPage('billing')
      }
    })
  }, [])

  /* ---------------------------------------------------------------- data */

  const signedIn = !authEnabled || account !== null

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      await ensureSeeded()
      await Promise.all([
        listProducts().then(setProducts),
        listCompanies().then(setCompanies),
        listInvoices().then(setInvoices),
        getSeller().then(setSeller),
      ])
      setReady(true)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the data.')
    }
  }, [])

  useEffect(() => {
    if (!signedIn || ready) return
    void load()
  }, [signedIn, ready, load])

  // The print copy renders first, then the browser dialog opens.
  useEffect(() => {
    if (!printPayload) return
    const id = window.setTimeout(() => {
      window.print()
      setPrintPayload(null)
    }, 80)
    return () => window.clearTimeout(id)
  }, [printPayload])

  /* ------------------------------------------------------------ handlers */

  const openBilling = (inv: Invoice | null, mode: DraftMode) => {
    setDraft(inv)
    setDraftMode(mode)
    setBillingKey((k) => k + 1)
    setPage('billing')
  }

  const navigate = (p: Page) => {
    if (p === 'billing' && page !== 'billing') {
      openBilling(null, 'new')
      return
    }
    setPage(p)
  }

  /* -------------------------------------------------------------- render */

  if (!authChecked) return <Splash text="Checking the session…" />
  if (authEnabled && !account) return <SignIn />

  if (loadError) {
    return (
      <div className="grid h-full place-items-center bg-bone px-6">
        <div className="anim-rise max-w-md text-center">
          <h2 className="font-display text-[22px] font-semibold text-ink">
            Could not load the counter
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{loadError}</p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            If this is the first run against Supabase, check that{' '}
            <code className="font-mono">supabase/schema.sql</code> has been run and that this
            account is allowed by the table policies.
          </p>
          <div className="mt-6 flex justify-center gap-2.5">
            <Button onClick={() => void load()}>Try again</Button>
            {authEnabled ? (
              <Button variant="ghost" onClick={() => void signOut()}>
                Sign out
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  if (!ready) return <Splash text="Opening the counter…" />

  return (
    <>
      <div className="screen-only flex h-full">
        {/* Below lg the sidebar is a drawer instead, so the bill gets the width. */}
        <div className="hidden lg:flex">
          <Sidebar
            page={page}
            onNavigate={navigate}
            invoiceCount={invoices.length}
            account={account}
            onSignOut={() => void signOut()}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar page={page} onMenu={() => setNavOpen(true)} />

          <main className="scroll-thin flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            {page === 'billing' && (
              <BillingPage
                key={billingKey}
                products={products}
                companies={companies}
                seller={seller}
                draft={draft}
                mode={draftMode}
                onCompaniesChanged={refreshCompanies}
                onSaved={() => {
                  refreshInvoices()
                  setDraftMode('edit')
                }}
                onPrint={setPrintPayload}
              />
            )}
            {page === 'repeat' && (
              <RepeatPage
                invoices={invoices}
                onRepeat={(inv) => openBilling(asRepeat(inv), 'repeat')}
              />
            )}
            {page === 'invoices' && (
              <InvoicesPage
                invoices={invoices}
                onChanged={refreshInvoices}
                onEdit={(inv) => openBilling(inv, 'edit')}
                onRepeat={(inv) => openBilling(asRepeat(inv), 'repeat')}
                onPrint={setPrintPayload}
              />
            )}
            {page === 'products' && (
              <ProductsPage products={products} onChanged={refreshProducts} />
            )}
            {page === 'companies' && (
              <CompaniesPage
                companies={companies}
                homeState={seller.state}
                onChanged={refreshCompanies}
              />
            )}
            {page === 'settings' && (
              <SettingsPage
                seller={seller}
                companies={companies}
                counts={{
                  products: products.length,
                  companies: companies.length,
                  invoices: invoices.length,
                }}
                onSellerChanged={setSeller}
                onCompaniesChanged={refreshCompanies}
                onChanged={() => {
                  refreshProducts()
                  refreshCompanies()
                  refreshInvoices()
                }}
              />
            )}
            </div>
          </main>
        </div>
      </div>

      <MobileDrawer
        open={navOpen}
        page={page}
        onNavigate={navigate}
        onClose={() => setNavOpen(false)}
        invoiceCount={invoices.length}
        account={account}
        onSignOut={() => void signOut()}
      />

      {/*
        Portalled to <body> as a direct child, and the print stylesheet hides
        every other child of <body>. That keeps full-screen overlays and modals
        — which are portalled too — out of the printed sheet.
      */}
      {createPortal(
        <div id="print-root">
          {printPayload ? (
            <InvoiceDocument
              meta={printPayload.meta}
              seller={seller}
              buyer={printPayload.buyer}
              items={printPayload.items}
              calc={calcInvoice(printPayload.items, printPayload.taxMode)}
            />
          ) : null}
        </div>,
        document.body,
      )}
    </>
  )
}

function Splash({ text }: { text: string }) {
  return (
    <div className="grid h-full place-items-center bg-bone">
      <div className="anim-fade font-display text-[17px] text-muted">{text}</div>
    </div>
  )
}
