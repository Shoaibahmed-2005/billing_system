import { useEffect, useMemo, useRef, useState } from 'react'
import {
  authEnabled,
  currentAccount,
  onAuthChange,
  signOut,
  type Account,
} from '@naveen/shared/auth'
import {
  deleteQuotation,
  ensureSeeded,
  listCompanies,
  listProducts,
  listQuotations,
  newId,
  saveQuotation,
} from '@naveen/shared/store'
import { getSeller } from '@naveen/shared/store'
import { SELLER } from '@naveen/shared/seller'
import type { Company, Product, Seller } from '@naveen/shared/types'
import {
  calcQuote,
  emptyQuoteMeta,
  newTermRow,
  nextQuoteNo,
  TERM_LABELS,
  type QuoteItem,
  type QuoteMeta,
  type QuoteTemplate,
  type Quotation,
} from '@naveen/shared/quote'
import { documentToPdfBlob } from '@naveen/shared/billPdf'
import { downloadBlob } from '@naveen/shared/pdf'
import { money, todayDotted } from '@naveen/shared/format'
import SignIn from '@naveen/shared/SignIn'
import { Button, Card, CardHead, Field, Input, Select } from '@naveen/shared/ui'
import QuotationDocument from './components/QuotationDocument'
import MaintenancePage from './MaintenancePage'
import SavedPage from './SavedPage'
import BackupCard from '@naveen/shared/BackupCard'
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

type View = 'quotations' | 'saved' | 'maintenance' | 'settings'

/**
 * Three screens behind three tabs, sharing one load of the companies and the
 * catalogue. Both come from the billing counter's database — the same rows
 * the other site reads and writes, so a company added at the counter is here
 * on the next load, and one imported here is at the counter.
 */
function Shell() {
  const [view, setView] = useState<View>('quotations')
  const [seller, setSeller] = useState<Seller>(SELLER)
  const [companies, setCompanies] = useState<Company[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [ready, setReady] = useState(false)

  /*
    Which quotation the desk is working on. null is a blank one. It is passed
    as the desk's key as well as its starting point, so opening a saved
    quotation rebuilds the desk around it rather than trying to patch a
    half-edited one into shape.
  */
  const [editing, setEditing] = useState<Quotation | null>(null)

  const load = async () => {
    setCompanies(await listCompanies())
    setProducts(await listProducts())
    setSeller(await getSeller())
    setQuotations(await listQuotations())
    setReady(true)
  }

  const open = (q: Quotation) => {
    setEditing(q)
    setView('quotations')
  }

  const startNew = () => {
    setEditing(null)
    setView('quotations')
  }

  const remove = async (q: Quotation) => {
    await deleteQuotation(q.id)
    if (editing?.id === q.id) setEditing(null)
    setQuotations(await listQuotations())
  }

  useEffect(() => {
    void (async () => {
      await ensureSeeded()
      await load()
    })()
  }, [])

  return (
    <>
      <nav className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-1.5 px-4 py-2.5 sm:px-6">
          <Tab on={view === 'quotations'} onClick={() => setView('quotations')}>
            {editing ? 'Editing' : 'New'}
          </Tab>
          <Tab on={view === 'saved'} onClick={() => setView('saved')}>
            Saved{quotations.length ? ` (${quotations.length})` : ''}
          </Tab>
          <Tab on={view === 'maintenance'} onClick={() => setView('maintenance')}>
            Maintenance
          </Tab>
          <Tab on={view === 'settings'} onClick={() => setView('settings')}>
            Settings
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
        <Desk
          key={editing?.id ?? 'new'}
          seller={seller}
          companies={companies}
          products={products}
          quotations={quotations}
          ready={ready}
          initial={editing}
          onSaved={async (q) => {
            setEditing(q)
            setQuotations(await listQuotations())
          }}
          onNew={startNew}
        />
      ) : view === 'saved' ? (
        <SavedPage
          quotations={quotations}
          onOpen={open}
          onDelete={(q) => void remove(q)}
          onNew={startNew}
        />
      ) : view === 'maintenance' ? (
        <MaintenancePage companies={companies} products={products} />
      ) : (
        <SettingsView onChanged={() => void load()} />
      )}
    </>
  )
}

/**
 * The spreadsheets, and nothing else yet.
 *
 * There is no second copy of the backup screen: it is the same card the
 * billing site shows, reading and writing the same tables. The ledger is not
 * offered here, because bills are the counter's business and a download of
 * them on this site would only raise the question of why.
 */
function SettingsView({ onChanged }: { onChanged: () => void }) {
  return (
    <div className="anim-rise mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
          Settings
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          The companies and the catalogue are shared with the billing site, so a change made in
          either one shows in both.
        </p>
      </header>
      <BackupCard onChanged={onChanged} bills={false} />
    </div>
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
      className={`rounded-full px-3 py-1.5 text-[13.5px] font-bold transition-colors sm:px-4 ${
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
  quotations,
  ready,
  initial,
  onSaved,
  onNew,
}: {
  seller: Seller
  companies: Company[]
  products: Product[]
  quotations: Quotation[]
  /** false until the saved list has been read, so an empty one means empty */
  ready: boolean
  /** the saved quotation being edited, or null for a blank one */
  initial: Quotation | null
  onSaved: (q: Quotation) => void | Promise<void>
  onNew: () => void
}) {
  const [template, setTemplate] = useState<QuoteTemplate>(initial?.meta.template ?? 'spares')
  const [meta, setMeta] = useState<QuoteMeta>(
    () => initial?.meta ?? emptyQuoteMeta('spares', todayDotted()),
  )
  const [buyerId, setBuyerId] = useState(initial?.buyer.id ?? '')
  const [items, setItems] = useState<QuoteItem[]>(initial?.items ?? [])
  /*
    The row this desk writes to. Set once it has been saved, so pressing Save
    twice corrects one quotation instead of leaving two behind.
  */
  const [savedId, setSavedId] = useState<string | null>(initial?.id ?? null)
  /*
    What was last written, to compare against. Asking "is this different
    from the stored copy" is steadier than counting changes: an effect that
    watches for edits also fires on mount, and React mounts twice in
    development, so the button claimed unsaved work the moment a saved
    quotation was opened.
  */
  const [savedAt, setSavedAt] = useState<string>(() =>
    initial ? JSON.stringify({ t: initial.meta.template, m: initial.meta, b: initial.buyer.id, i: initial.items }) : '',
  )

  /*
    The spares series is a plain running number, so a blank one starts at the
    next free one rather than at nothing. Suggested, not enforced: it is an
    ordinary field and typing over it is the point. Done once, the first time
    the saved list arrives, so clearing the field on purpose stays cleared.
  */
  const numbered = useRef(false)
  useEffect(() => {
    if (numbered.current || !ready || initial || template !== 'spares') return
    numbered.current = true
    setMeta((m) => (m.slNo.trim() ? m : { ...m, slNo: nextQuoteNo(quotations) }))
  }, [quotations, ready, initial, template])
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')

  const sheet = useRef<HTMLDivElement>(null)
  const sheetWidthMm = template === 'machine' ? 178 : 164.7
  const [showSignature, setShowSignature] = useState(true)
  const { box, scale, height } = useFitToWidth(sheet, sheetWidthMm)

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

  /*
    Anything typed after a save means the stored copy is behind. Watched
    rather than compared field by field: the point is only to tell the
    counter that Save has something to do, not to be clever about it.
  */
  const shape = JSON.stringify({ t: template, m: meta, b: buyerId, i: items })
  const dirty = shape !== savedAt

  /**
   * Saving. The whole document is kept, not a reference to the catalogue:
   * a quotation reprinted next year has to say what it said when it was
   * sent, whatever the price list does in between.
   */
  const save = async () => {
    if (!buyer) return say('Choose the company this quotation is for.')
    if (!items.length) return say('Add at least one line.')
    setSaving(true)
    try {
      const record: Quotation = {
        id: savedId ?? newId('q'),
        meta,
        buyer,
        items,
        // the machine sheet prints no total, so the bare sum is what it has
        total: template === 'machine' ? calc.subTotal : calc.total,
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      }
      await saveQuotation(record)
      setSavedId(record.id)
      setSavedAt(JSON.stringify({ t: template, m: meta, b: buyer.id, i: items }))
      await onSaved(record)
      say(savedId ? 'Saved over the earlier copy.' : 'Saved.')
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not save it.')
    } finally {
      setSaving(false)
    }
  }

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
            {savedId
              ? `Saved quotation${meta.slNo ? ` No ${meta.slNo}` : ''} · ${meta.dated}`
              : `${seller.name} · the same companies and parts as the billing counter`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedId ? (
            <Button variant="ghost" size="sm" onClick={onNew}>
              New
            </Button>
          ) : null}
          <Button variant="outline" size="sm" disabled={busy} onClick={savePdf}>
            {busy ? 'Building…' : 'Save PDF'}
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : savedId && !dirty ? 'Saved' : 'Save'}
          </Button>
        </div>
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

          {/*
            Beside the sheet for the same reason the term buttons are: what
            it changes is visible in the preview as you press it.
          */}
          {seller.signature ? (
            <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-xl2 border border-line bg-card px-4 py-3">
              <input
                type="checkbox"
                checked={showSignature}
                onChange={(e) => setShowSignature(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#b4713a]"
              />
              <span className="text-[12.5px] leading-snug text-ink-2">
                <b className="font-semibold text-ink">Print the signature</b>
                <br />
                Turn it off to leave the space blank and sign the sheet by hand.
              </span>
            </label>
          ) : null}

          <div
            ref={box}
            className="overflow-hidden rounded-xl2 border border-line bg-bone-2 p-4"
            style={{ height: height ? `${height}px` : `calc(174mm * ${scale} + 2rem)` }}
          >
            <div
              ref={sheet}
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: `${sheetWidthMm}mm`,
                // one page unless the quotation needs more than one
                minHeight: '174mm',
              }}
            >
              <QuotationDocument
                meta={meta}
                seller={seller}
                buyer={buyer}
                items={items}
                fillTo={template === 'machine' ? 6 : 8}
                signature={showSignature ? seller.signature ?? null : null}
                className="quo-screen"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The quotation sheet is drawn at its real printed width — 164.7mm or
 * 178mm — and then scaled down to sit on screen. A fixed scale works on a
 * laptop and fails on a phone, where the sheet ends up wider than the box
 * and half the quotation is behind a sideways drag nobody discovers.
 *
 * So the box is measured and the sheet scaled to fit it, never past 0.62,
 * which is the size it has always been on a wide screen.
 *
 * The height has to be measured too, and that is the part that was wrong.
 * A CSS transform shrinks what you see and not what the layout reserves, so
 * the box cannot simply wrap the sheet — it would leave a page of white
 * space under every quotation. Giving it the height of one A4 page instead
 * looked right until a quotation ran longer than a page: the sheet kept
 * growing, the box did not, and the last few lines were cut off with
 * nothing to scroll. So the real height is read off the sheet and scaled by
 * the same factor, and the box is exactly as tall as what it is showing,
 * however many lines that is.
 */
function useFitToWidth(sheet: React.RefObject<HTMLDivElement>, widthMm: number) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.62)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = box.current
    if (!el) return

    const measure = () => {
      const padding = 32 // p-4 on both sides
      const sheetPx = (widthMm * 96) / 25.4
      const room = el.clientWidth - padding
      const next = Math.min(0.62, Math.max(0.25, room / sheetPx))
      setScale(next)
      // offsetHeight is the laid-out height, which the transform does not touch
      const tall = sheet.current?.offsetHeight ?? 0
      // the +2 keeps rounding from shaving the hairline border off the foot
      if (tall) setHeight(Math.ceil(tall * next) + padding + 2)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (sheet.current) ro.observe(sheet.current)
    return () => ro.disconnect()
  }, [sheet, widthMm])

  return { box, scale, height }
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


