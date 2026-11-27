import { useEffect, useMemo, useRef, useState } from 'react'
import {
  authEnabled,
  currentAccount,
  onAuthChange,
  signOut,
  type Account,
} from '@naveen/shared/auth'
import { ensureSeeded, listCompanies, listProducts, newId } from '@naveen/shared/store'
import { getSeller } from '@naveen/shared/store'
import { SELLER } from '@naveen/shared/seller'
import type { Company, Product, Seller } from '@naveen/shared/types'
import {
  calcQuote,
  emptyQuoteMeta,
  newTermRow,
  TERM_LABELS,
  type QuoteItem,
  type QuoteMeta,
  type QuoteTemplate,
} from '@naveen/shared/quote'
import { documentToPdfBlob } from '@naveen/shared/billPdf'
import { downloadBlob } from '@naveen/shared/pdf'
import { money, todayDotted } from '@naveen/shared/format'
import SignIn from '@naveen/shared/SignIn'
import { Button, Card, CardHead, Field, Input, Select } from '@naveen/shared/ui'
import QuotationDocument from './components/QuotationDocument'
import MaintenancePage from './MaintenancePage'
import './styles/quotation.css'

/**
 * The quotations desk.
 *
 * The firm sends two different sheets and keeps both, so the template is the
 * first choice on the screen rather than something buried in a menu: the two
 * buttons at the top switch the whole document, headings and totals and
 * terms together.
 *
 * Everything else — the companies, the parts, the firm's own block — is read
 * from the billing counter's database through the shared store. There is no
 * second catalogue to keep up to date.
 */
export default function App() {
  const [checked, setChecked] = useState(!authEnabled)
  const [account, setAccount] = useState<Account | null>(null)

  useEffect(() => {
    if (!authEnabled) return
    void currentAccount().then((a) => {
      setAccount(a)
      setChecked(true)
    })
    return onAuthChange(setAccount)
  }, [])

  const signedIn = !authEnabled || account !== null

  if (!checked) {
    return (
      <div className="grid min-h-full place-items-center text-[13px] text-muted">
        Checking the session…
      </div>
    )
  }
  if (!signedIn) return <SignIn />
  return <Shell />
}

type View = 'quotations' | 'maintenance'

/**
 * Two screens behind two tabs, sharing one load of the companies and the
 * catalogue. Both come from the billing counter's database.
 */
function Shell() {
  const [view, setView] = useState<View>('quotations')
  const [seller, setSeller] = useState<Seller>(SELLER)
  const [companies, setCompanies] = useState<Company[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    void (async () => {
      await ensureSeeded()
      setCompanies(await listCompanies())
      setProducts(await listProducts())
      setSeller(await getSeller())
    })()
  }, [])

  return (
    <>
      <nav className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-1.5 px-4 py-2.5 sm:px-6">
          <Tab on={view === 'quotations'} onClick={() => setView('quotations')}>
            Quotations
          </Tab>
          <Tab on={view === 'maintenance'} onClick={() => setView('maintenance')}>
            Maintenance
          </Tab>
          {authEnabled ? (
            <Button
              className="ml-auto"
              variant="ghost"
              size="sm"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          ) : null}
        </div>
      </nav>

      {view === 'quotations' ? (
        <Desk seller={seller} companies={companies} products={products} />
      ) : (
        <MaintenancePage companies={companies} products={products} />
      )}
    </>
  )
}

function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-[13.5px] font-bold transition-colors ${
        on ? 'bg-espresso text-bone' : 'text-ink-2 hover:bg-bone-2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function Desk({
  seller,
  companies,
  products,
}: {
  seller: Seller
  companies: Company[]
  products: Product[]
}) {
  const [template, setTemplate] = useState<QuoteTemplate>('spares')
  const [meta, setMeta] = useState<QuoteMeta>(() => emptyQuoteMeta('spares', todayDotted()))
  const [buyerId, setBuyerId] = useState('')
  const [items, setItems] = useState<QuoteItem[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const sheet = useRef<HTMLDivElement>(null)

  /*
    Switching template keeps the buyer and the lines — they are the same
    either way — and takes the headings, the terms and the signatory from
    the new template's own defaults. Anything typed into those fields is
    deliberately not carried across: the two sheets word them differently.
  */
  const switchTemplate = (next: QuoteTemplate) => {
    if (next === template) return
    setTemplate(next)
    setMeta((m) => ({ ...emptyQuoteMeta(next, m.dated), slNo: m.slNo, ref: m.ref }))
  }

  const buyer = companies.find((c) => c.id === buyerId) ?? null
  const calc = calcQuote(items, meta.gstRate)

  const addProduct = (p: Product) =>
    setItems((list) => [
      ...list,
      {
        lineId: newId('q'),
        productId: p.id,
        description: p.name,
        hsn: p.hsn,
        qty: 1,
        unit: p.unit ? `1 ${p.unit}` : '1 No',
        rate: p.rate,
        kind: p.kind,
      },
    ])

  /*
    Most of a quotation is typed, not picked. The catalogue is there for the
    parts that are in it; this is for everything else, which is most of what
    they quote for.
  */
  const addBlankLine = () =>
    setItems((list) => [
      ...list,
      { lineId: newId('q'), productId: null, description: '', hsn: '', qty: 1, unit: '', rate: 0, kind: 'goods' },
    ])

  const patch = (lineId: string, p: Partial<QuoteItem>) =>
    setItems((list) => list.map((i) => (i.lineId === lineId ? { ...i, ...p } : i)))

  const addTerm = (label: string) =>
    setMeta((m) => ({ ...m, terms: [...m.terms, newTermRow(label)] }))

  const patchTerm = (id: string, p: Partial<{ label: string; value: string }>) =>
    setMeta((m) => ({ ...m, terms: m.terms.map((t) => (t.id === id ? { ...t, ...p } : t)) }))

  const removeTerm = (id: string) =>
    setMeta((m) => ({ ...m, terms: m.terms.filter((t) => t.id !== id) }))

  const remove = (lineId: string) => setItems((list) => list.filter((i) => i.lineId !== lineId))

  const say = (t: string) => {
    setNote(t)
    window.setTimeout(() => setNote(''), 3500)
  }

  const savePdf = async () => {
    if (!buyer) return say('Choose the company this quotation is for.')
    if (!items.length) return say('Add at least one line.')
    const node = sheet.current?.querySelector<HTMLElement>('.quo')
    if (!node) return
    setBusy(true)
    try {
      const width = template === 'machine' ? 178 : 164.7
      const blob = await documentToPdfBlob(node, width)
      const who = buyer.name.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
      downloadBlob(blob, `Quotation-${meta.slNo || meta.dated}-${who}.pdf`)
      say('Saved.')
    } catch {
      say('Could not build the PDF.')
    } finally {
      setBusy(false)
    }
  }

  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = products.filter((p) => p.active)
    if (!t) return list.slice(0, 8)
    return list.filter((p) => `${p.name} ${p.hsn}`.toLowerCase().includes(t)).slice(0, 8)
  }, [products, q])

  return (
    <div className="anim-rise mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
            Quotations
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {seller.name} · the same companies and parts as the billing counter
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={busy} onClick={savePdf}>
          {busy ? 'Building…' : 'Save PDF'}
        </Button>
      </header>

      {/* the choice that changes the whole document, first thing on the page */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-xl2 border border-line bg-bone px-4 py-3">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
          Template
        </span>
        <TemplateButton
          active={template === 'spares'}
          onClick={() => switchTemplate('spares')}
          title="Spares"
          note="prices and totals"
        />
        <TemplateButton
          active={template === 'machine'}
          onClick={() => switchTemplate('machine')}
          title="Machine"
          note="GST extra, no total"
        />
        {note ? (
          <span className="ml-auto text-[12.5px] font-semibold text-sage">{note}</span>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHead title="Quotation details" />
            <div className="grid gap-3.5 px-4 py-4 sm:px-5 sm:grid-cols-2">
              <Field label="For company" className="sm:col-span-2">
                <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
                  <option value="">Select a company…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Dated">
                <Input
                  value={meta.dated}
                  onChange={(e) => setMeta({ ...meta, dated: e.target.value })}
                />
              </Field>

              {template === 'spares' ? (
                <>
                  <Field label="SI No">
                    <Input
                      value={meta.slNo}
                      onChange={(e) => setMeta({ ...meta, slNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Ref">
                    <Input
                      value={meta.ref}
                      onChange={(e) => setMeta({ ...meta, ref: e.target.value })}
                    />
                  </Field>
                  <Field label="Ref date">
                    <Input
                      value={meta.refDate}
                      onChange={(e) => setMeta({ ...meta, refDate: e.target.value })}
                    />
                  </Field>
                </>
              ) : (
                <Field label="Subject" className="sm:col-span-2">
                  <Input
                    value={meta.subject}
                    onChange={(e) => setMeta({ ...meta, subject: e.target.value })}
                  />
                </Field>
              )}
            </div>
          </Card>

          <Card>
            <CardHead
              title="Terms"
              subtitle="Only the lines added here are printed. Add more with the + buttons by the sheet."
            />
            <div className="space-y-2.5 px-4 py-4 sm:px-5">
              {meta.terms.length === 0 ? (
                <p className="text-[12.5px] text-muted">
                  No terms on this quotation. TERMS &amp; CONDITIONS will not be printed at all.
                </p>
              ) : null}
              {/*
                Widths are set on the wrappers, not on the inputs. Input
                carries its own w-full, and which of two Tailwind classes
                wins depends on their order in the generated stylesheet
                rather than the order they are written here — so the narrow
                one quietly came out full width.
              */}
              {meta.terms.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="w-[96px] shrink-0">
                    <Input
                      value={t.label}
                      onChange={(e) => patchTerm(t.id, { label: e.target.value })}
                      aria-label="Terms line name"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Input
                      value={t.value}
                      onChange={(e) => patchTerm(t.id, { value: e.target.value })}
                      aria-label={t.label}
                    />
                  </div>
                  <button
                    onClick={() => removeTerm(t.id)}
                    aria-label={`Remove ${t.label}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-clay/12 hover:text-clay"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead
              title="Lines"
              subtitle={
                template === 'spares'
                  ? `Sub-total ${money(calc.subTotal)} · Total ${money(calc.total)}`
                  : `${items.length} line${items.length === 1 ? '' : 's'} · GST quoted as extra`
              }
            />
            <div className="px-4 py-4 sm:px-5">
              <Input

                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the catalogue to add a line…"
              />
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button
                  onClick={addBlankLine}
                  className="rounded-full border border-dashed border-line-2 bg-card px-3 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:border-copper hover:text-copper"
                >
                  + Blank line
                </button>
                {shown.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="rounded-full border border-line bg-card px-3 py-1.5 text-[12px] text-ink transition-colors hover:border-copper hover:text-copper"
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-2.5">
                {items.map((i) => (
                  <div key={i.lineId} className="rounded-xl2 border border-line bg-bone/40 p-2.5">
                    <Input
                      value={i.description}
                      onChange={(e) => patch(i.lineId, { description: e.target.value })}
                    />
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      <Input
                        value={i.hsn}
                        onChange={(e) => patch(i.lineId, { hsn: e.target.value })}
                        aria-label="HSN"
                      />
                      <Input
                        value={i.unit}
                        onChange={(e) => patch(i.lineId, { unit: e.target.value })}
                        aria-label="Unit"
                      />
                      <Input
                        value={String(i.qty)}
                        onChange={(e) => patch(i.lineId, { qty: Number(e.target.value) || 0 })}
                        aria-label="Qty"
                      />
                      <Input
                        value={String(i.rate)}
                        onChange={(e) => patch(i.lineId, { rate: Number(e.target.value) || 0 })}
                        aria-label="Rate"
                      />
                    </div>
                    <button
                      onClick={() => remove(i.lineId)}
                      className="mt-1.5 text-[12px] font-semibold text-muted hover:text-clay"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* the sheet itself, at half size so a whole page fits on screen */}
        <div className="min-w-0">
          {/*
            The + buttons sit against the sheet rather than in the form,
            because what they do is add a line to the sheet — press one and
            it appears under TERMS & CONDITIONS, where you can see it.
          */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
              Add a terms line
            </span>
            {TERM_LABELS[template]
              .filter((l) => !meta.terms.some((t) => t.label === l))
              .map((l) => (
                <button
                  key={l}
                  onClick={() => addTerm(l)}
                  className="rounded-full border border-line-2 bg-card px-3 py-1 text-[12px] font-semibold text-ink transition-colors hover:border-copper hover:text-copper"
                >
                  + {l}
                </button>
              ))}
            <button
              onClick={() => addTerm('')}
              className="rounded-full border border-dashed border-line-2 bg-card px-3 py-1 text-[12px] font-semibold text-muted transition-colors hover:border-copper hover:text-copper"
            >
              + Something else
            </button>
          </div>

          <div className="overflow-auto rounded-xl2 border border-line bg-bone-2 p-4">
            <div
              ref={sheet}
              style={{
                transform: 'scale(0.62)',
                transformOrigin: 'top left',
                width: template === 'machine' ? '178mm' : '164.7mm',
                height: '174mm',
              }}
            >
              <QuotationDocument
                meta={meta}
                seller={seller}
                buyer={buyer}
                items={items}
                fillTo={template === 'machine' ? 6 : 8}
                className="quo-screen"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateButton({
  active,
  onClick,
  title,
  note,
}: {
  active: boolean
  onClick: () => void
  title: string
  note: string
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-left transition-all duration-200 ${
        active
          ? 'border-copper bg-copper text-bone shadow-[0_6px_18px_-6px_rgba(180,113,58,0.7)]'
          : 'border-line-2 bg-card text-ink hover:border-copper hover:text-copper'
      }`}
    >
      <span className="block text-[13px] font-bold leading-none">{title}</span>
      <span className={`block text-[11px] ${active ? 'text-bone/80' : 'text-muted'}`}>{note}</span>
    </button>
  )
}


