import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  Company,
  Invoice,
  InvoiceItem,
  InvoiceMeta,
  Product,
  Seller,
  TaxMode,
} from '../lib/types'
import { calcInvoice, taxModeForBuyer } from '../lib/gst'
import { money, plain, round4, todayDotted } from '../lib/format'
import { downloadBlob, invoiceFileName, invoiceToPdfBlob, sharePdf } from '../lib/pdf'
import { newId, saveCompany, saveInvoice } from '../lib/store'
import InvoiceDocument from '../components/InvoiceDocument'
import CompanyForm from '../components/CompanyForm'
import { Button, Card, CardHead, Field, Input, Modal, Pill, Select } from '../components/ui'

const emptyMeta = (): InvoiceMeta => ({
  invoiceNo: '',
  dated: todayDotted(),
  modeTerms: '100% Against Service',
  customerPoNo: '',
  despatchThrough: 'By Direct',
  destination: '',
  termsOfDelivery: 'Paid',
})

const toItem = (p: Product): InvoiceItem => ({
  lineId: newId('l'),
  productId: p.id,
  description: p.name,
  hsn: p.hsn,
  qty: 1,
  unit: p.unit,
  rate: p.rate,
  per: p.per,
  gstRate: p.gstRate,
  kind: p.kind,
})

export default function BillingPage({
  products,
  companies,
  seller,
  draft,
  mode,
  onCompaniesChanged,
  onSaved,
  onPrint,
}: {
  products: Product[]
  companies: Company[]
  seller: Seller
  draft: Invoice | null
  mode: 'new' | 'edit' | 'repeat'
  onCompaniesChanged: () => void
  onSaved: (inv: Invoice) => void
  onPrint: (payload: {
    meta: InvoiceMeta
    buyer: Company | null
    items: InvoiceItem[]
    taxMode: TaxMode
  }) => void
}) {
  const [meta, setMeta] = useState<InvoiceMeta>(draft?.meta ?? emptyMeta())
  const [buyerId, setBuyerId] = useState<string>(draft?.buyer.id ?? '')
  const [items, setItems] = useState<InvoiceItem[]>(draft?.items ?? [])
  const [override, setOverride] = useState<TaxMode | null>(
    draft && !draft.taxModeAuto ? draft.taxMode : null,
  )
  const [invoiceId] = useState<string>(draft?.id ?? newId('inv'))
  const [search, setSearch] = useState('')
  const [addCompany, setAddCompany] = useState(false)
  const [editCompany, setEditCompany] = useState(false)
  const [preview, setPreview] = useState(false)
  const [flash, setFlash] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const buyer = useMemo(
    () => companies.find((c) => c.id === buyerId) ?? draft?.buyer ?? null,
    [companies, buyerId, draft],
  )
  const autoMode = taxModeForBuyer(buyer, seller.state)
  const taxMode: TaxMode = override ?? autoMode
  const calc = useMemo(() => calcInvoice(items, taxMode), [items, taxMode])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const live = products.filter((p) => p.active)
    if (!q) return live
    return live.filter((p) => p.name.toLowerCase().includes(q) || p.hsn.toLowerCase().includes(q))
  }, [products, search])

  const setMetaField = (k: keyof InvoiceMeta, v: string) => setMeta((m) => ({ ...m, [k]: v }))

  const patchItem = (lineId: string, patch: Partial<InvoiceItem>) =>
    setItems((list) => list.map((i) => (i.lineId === lineId ? { ...i, ...patch } : i)))

  /**
   * Bargaining on the Sub Total / Total line.
   *
   * The lines are snapshotted when the cell is focused and every keystroke
   * scales from that snapshot, so typing "20000" one digit at a time lands on
   * the right figure instead of compounding "2" then "20" then "200".
   */
  const scaleBase = useRef<InvoiceItem[] | null>(null)

  const beginTotalEdit = () => {
    scaleBase.current = items
  }

  const setTotal = (target: number, which: 'sub' | 'grand') => {
    const base = scaleBase.current ?? items
    const baseCalc = calcInvoice(base, taxMode)
    const from = which === 'sub' ? baseCalc.subTotal : baseCalc.rawTotal
    if (target <= 0 || from <= 0) return
    const factor = target / from
    if (!Number.isFinite(factor) || factor <= 0) return
    setItems(base.map((i) => ({ ...i, rate: round4(i.rate * factor) })))
  }

  const addItem = (p: Product) => {
    setItems((list) => {
      const existing = list.find((i) => i.productId === p.id && i.kind === 'goods')
      if (existing) {
        return list.map((i) => (i.lineId === existing.lineId ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...list, toItem(p)]
    })
    setFlash(null)
  }

  const say = (tone: 'ok' | 'bad', text: string) => {
    setFlash({ tone, text })
    window.setTimeout(() => setFlash(null), 3200)
  }

  const validate = (): string | null => {
    if (!meta.invoiceNo.trim()) return 'Enter the invoice number before saving.'
    if (!buyer) return 'Select the company this bill is for.'
    if (items.length === 0) return 'Add at least one product or service.'
    return null
  }

  const buildInvoice = (): Invoice => ({
    id: invoiceId,
    meta,
    buyer: buyer as Company,
    items,
    taxMode,
    taxModeAuto: override === null,
    createdAt: draft?.createdAt ?? new Date().toISOString(),
    grandTotal: calc.grandTotal,
  })

  const save = async (thenPrint: boolean) => {
    const err = validate()
    if (err) {
      say('bad', err)
      return false
    }
    const inv = buildInvoice()
    await saveInvoice(inv)
    onSaved(inv)
    say('ok', `Invoice ${inv.meta.invoiceNo} saved.`)
    if (thenPrint) onPrint({ meta, buyer, items, taxMode })
    return true
  }

  const openPreview = () => {
    if (items.length === 0) return say('bad', 'Add at least one product or service first.')
    if (!buyer) return say('bad', 'Select the company this bill is for.')
    setPreview(true)
  }

  const clearAll = () => {
    setMeta(emptyMeta())
    setBuyerId('')
    setItems([])
    setOverride(null)
  }

  return (
    <div className="anim-rise">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
            {mode === 'edit' ? 'Edit Bill' : mode === 'repeat' ? 'Repeat Bill' : 'New Bill'}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {mode === 'repeat'
              ? 'Copied from an earlier bill — give it a new invoice number, adjust what changed, and save.'
              : 'Pick the buyer, tap the parts, then settle the price in the preview.'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={() => save(false)}>
            Save
          </Button>
          <Button size="sm" onClick={openPreview}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            Preview &amp; Print
          </Button>
        </div>
      </header>

      {flash ? (
        <div
          className={`anim-rise mb-5 rounded-xl2 px-4 py-3 text-[13.5px] font-semibold ${
            flash.tone === 'ok' ? 'bg-sage/12 text-sage' : 'bg-clay/10 text-clay'
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1 space-y-5">
          {/* ------------------------------------------------ buyer + meta */}
          <Card>
            <CardHead
              title="Bill details"
              subtitle="Everything on the right of the bill is typed by hand, exactly as you do today."
            />
            <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-2">
              <div className="space-y-4">
                <Field label="Bill to (Consignee)">
                  <div className="flex gap-2">
                    <Select
                      value={buyerId}
                      onChange={(e) => {
                        setBuyerId(e.target.value)
                        setOverride(null)
                      }}
                    >
                      <option value="">Select a company…</option>
                      {companies
                        .filter((c) => c.active)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.state}
                          </option>
                        ))}
                    </Select>
                    <Button variant="outline" size="md" onClick={() => setAddCompany(true)}>
                      + New
                    </Button>
                  </div>
                </Field>

                {buyer ? (
                  <div className="anim-fade relative rounded-xl2 border border-line bg-bone px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-2">
                    <button
                      onClick={() => setEditCompany(true)}
                      className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-card px-3 py-1
                        text-[11.5px] font-bold text-ink-2 transition-all duration-200
                        hover:-translate-y-0.5 hover:border-copper hover:text-copper
                        hover:shadow-[0_8px_18px_-10px_rgba(180,113,58,0.9)]"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 20h4L19 9l-4-4L4 16v4zM14.5 5.5l4 4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Edit
                    </button>
                    <div className="pr-16 font-bold text-ink">{buyer.name}</div>
                    {buyer.addressLines.map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                    <div className="mt-1 font-mono text-[12px]">GST: {buyer.gstin}</div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 rounded-xl2 border border-line bg-bone px-4 py-3">
                  {taxMode === 'intra' ? (
                    <Pill tone="sage">CGST + SGST</Pill>
                  ) : (
                    <Pill tone="copper">IGST</Pill>
                  )}
                  <span className="flex-1 text-[12.5px] text-ink-2">
                    {buyer
                      ? taxMode === 'intra'
                        ? `${buyer.state} — tax splits into Central and State.`
                        : `${buyer.state} — inter-state, so one IGST line.`
                      : 'Select a company to set the tax type.'}
                  </span>
                  <button
                    onClick={() =>
                      setOverride(taxMode === 'intra' ? 'inter' : override ? null : 'intra')
                    }
                    className="rounded-full border border-line-2 px-3 py-1 text-[11.5px] font-bold text-ink-2 transition-colors hover:border-copper hover:text-copper"
                  >
                    {override ? 'Back to auto' : `Force ${taxMode === 'intra' ? 'IGST' : 'CGST+SGST'}`}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <Field label="Invoice No.">
                  <Input
                    value={meta.invoiceNo}
                    onChange={(e) => setMetaField('invoiceNo', e.target.value)}
                    placeholder="145/2026-2027"
                  />
                </Field>
                <Field label="Dated">
                  <Input
                    value={meta.dated}
                    onChange={(e) => setMetaField('dated', e.target.value)}
                    placeholder="02.09.2026"
                  />
                </Field>
                <Field label="Mode / Terms of Payment" className="col-span-2">
                  <Input
                    value={meta.modeTerms}
                    onChange={(e) => setMetaField('modeTerms', e.target.value)}
                    placeholder="100% Against Service"
                  />
                </Field>
                <Field label="Customer PO No." className="col-span-2">
                  <Input
                    value={meta.customerPoNo}
                    onChange={(e) => setMetaField('customerPoNo', e.target.value)}
                    placeholder="PT/26-27/213, dt 31.08.2026"
                  />
                </Field>
                <Field label="Despatch Through">
                  <Input
                    value={meta.despatchThrough}
                    onChange={(e) => setMetaField('despatchThrough', e.target.value)}
                    placeholder="By Direct"
                  />
                </Field>
                <Field label="Destination">
                  <Input
                    value={meta.destination}
                    onChange={(e) => setMetaField('destination', e.target.value)}
                    placeholder="Chennai"
                  />
                </Field>
                <Field label="Terms of Delivery" className="col-span-2">
                  <Input
                    value={meta.termsOfDelivery}
                    onChange={(e) => setMetaField('termsOfDelivery', e.target.value)}
                    placeholder="Paid"
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* ---------------------------------------------- product picker */}
          <Card>
            <CardHead
              title="Catalogue"
              subtitle={`${filtered.length} item${filtered.length === 1 ? '' : 's'} — tap to add; the listed rate is only a starting figure`}
              right={
                <div className="w-56">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or HSN…"
                    className="h-10 py-2"
                  />
                </div>
              }
            />
            <div className="scroll-thin max-h-[290px] overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addItem(p)}
                    className="group rounded-xl2 border border-line bg-card px-3.5 py-3 text-left
                      transition-all duration-200 ease-out
                      hover:-translate-y-0.5 hover:scale-[1.025] hover:border-copper
                      hover:shadow-[0_14px_28px_-18px_rgba(180,113,58,0.9)] active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-[13px] font-bold leading-snug text-ink">
                        {p.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-bone-2 px-2 py-0.5 font-mono text-[10.5px] text-ink-2">
                        {p.hsn}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-copper">{money(p.rate)}</span>
                      <span className="text-[11px] text-muted">
                        {p.kind === 'service' ? 'Service' : `per ${p.per}`} · {p.gstRate}%
                      </span>
                    </div>
                  </button>
                ))}
                {filtered.length === 0 ? (
                  <p className="col-span-full py-8 text-center text-[13px] text-muted">
                    Nothing matches “{search}”.
                  </p>
                ) : null}
              </div>
            </div>
          </Card>

          {/* ------------------------------------------------------- lines */}
          <Card>
            <CardHead
              title="Items on this bill"
              subtitle={`${items.length} line${items.length === 1 ? '' : 's'} — prices are settled in the preview`}
              right={
                items.length > 0 ? (
                  <Button variant="outline" size="sm" onClick={openPreview}>
                    Open preview
                  </Button>
                ) : undefined
              }
            />
            {items.length === 0 ? (
              <p className="px-6 py-12 text-center text-[13.5px] text-muted">
                No items yet — tap something from the catalogue above.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
                      <th className="w-10 py-2.5 pl-6 text-left">#</th>
                      <th className="py-2.5 text-left">Description</th>
                      <th className="w-24 py-2.5 text-left">HSN</th>
                      <th className="w-24 py-2.5 text-right">Qty</th>
                      <th className="w-28 py-2.5 text-right">Rate</th>
                      <th className="w-28 py-2.5 text-right">Taxable</th>
                      <th className="w-28 py-2.5 text-right">GST</th>
                      <th className="w-12 py-2.5 pr-5" />
                    </tr>
                  </thead>
                  <tbody className="stagger">
                    {items.map((it, idx) => {
                      const line = calc.lines[idx]
                      const isService = it.kind === 'service'
                      return (
                        <tr
                          key={it.lineId}
                          className="group border-b border-line/70 transition-colors last:border-0 hover:bg-bone/60"
                        >
                          <td className="py-2 pl-6 text-muted">{idx + 1}</td>
                          <td className="py-2 pr-3">
                            <input
                              value={it.description}
                              onChange={(e) => patchItem(it.lineId, { description: e.target.value })}
                              className="w-full rounded-lg bg-transparent px-1.5 py-1 font-semibold text-ink outline-none transition-colors focus:bg-bone-2"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              value={it.hsn}
                              onChange={(e) => patchItem(it.lineId, { hsn: e.target.value })}
                              className="w-full rounded-lg bg-transparent px-1.5 py-1 font-mono text-[12px] text-ink-2 outline-none transition-colors focus:bg-bone-2"
                            />
                          </td>
                          <td className="py-2 text-right">
                            {isService ? (
                              <span className="pr-1.5 text-muted">—</span>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={it.qty}
                                onChange={(e) => patchItem(it.lineId, { qty: Number(e.target.value) })}
                                className="w-20 rounded-lg bg-transparent px-1.5 py-1 text-right tabular-nums outline-none transition-colors focus:bg-bone-2"
                              />
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={it.rate}
                              onChange={(e) => patchItem(it.lineId, { rate: Number(e.target.value) })}
                              className="w-24 rounded-lg bg-transparent px-1.5 py-1 text-right tabular-nums outline-none transition-colors focus:bg-bone-2"
                            />
                          </td>
                          <td className="py-2 pr-1.5 text-right font-bold tabular-nums text-ink">
                            {plain(line?.taxable ?? 0)}
                          </td>
                          <td className="py-2 pr-1.5 text-right tabular-nums text-ink-2">
                            {plain(line?.tax ?? 0)}
                            <span className="ml-1 text-[10.5px] text-muted">{it.gstRate}%</span>
                          </td>
                          <td className="py-2 pr-5 text-right">
                            <button
                              onClick={() => setItems((l) => l.filter((x) => x.lineId !== it.lineId))}
                              aria-label="Remove line"
                              className="grid h-7 w-7 place-items-center rounded-full text-muted opacity-0 transition-all
                                group-hover:opacity-100 hover:bg-clay/12 hover:text-clay focus:opacity-100"
                            >
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                                <path
                                  d="M4 4l8 8M12 4l-8 8"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ----------------------------------------------- tax breakdown */}
          {items.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
              <Card>
                <CardHead
                  title="GST, separated"
                  subtitle="Grouped the way the bill prints it — one row per HSN/SAC."
                />
                <HsnTable calc={calc} />
              </Card>

              <Card className="overflow-hidden">
                <div className="space-y-2 px-6 py-5 text-[13.5px]">
                  <Row label="Sub Total" value={plain(calc.subTotal)} />
                  {taxMode === 'intra' ? (
                    <>
                      <Row label="CGST" value={plain(calc.cgst)} />
                      <Row label="SGST" value={plain(calc.sgst)} />
                    </>
                  ) : (
                    <Row label="IGST" value={plain(calc.igst)} />
                  )}
                  <Row label="Rounded Off" value={plain(calc.roundOff)} />
                </div>
                <div className="flex items-end justify-between bg-espresso px-6 py-5 text-bone">
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-bone/45">
                      Total payable
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-bone/50">
                      incl. {plain(calc.totalTax)} tax
                    </div>
                  </div>
                  <div className="font-display text-[28px] font-semibold leading-none text-copper-2">
                    {money(calc.grandTotal)}
                  </div>
                </div>
              </Card>
            </div>
          ) : null}
        </div>

        {/* --------------------------------------------- mini side preview */}
        <aside className="sticky top-8 hidden w-[404px] shrink-0 2xl:block">
          <Card className="overflow-hidden">
            <CardHead
              title="Print preview"
              subtitle="Exactly what comes out of the printer"
              right={
                <Button size="sm" variant="dark" onClick={openPreview}>
                  Open
                </Button>
              }
            />
            <button
              onClick={openPreview}
              className="block w-full cursor-zoom-in bg-bone-2 p-4 text-left transition-colors hover:bg-line/70"
            >
              <div className="h-[560px] overflow-hidden rounded-lg">
                <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '734px' }}>
                  <InvoiceDocument
                    meta={meta}
                    seller={seller}
                    buyer={buyer}
                    items={items}
                    calc={calc}
                    className="inv-screen"
                  />
                </div>
              </div>
            </button>
          </Card>
        </aside>
      </div>

      {/* ------------------------------------------------- preview overlay */}
      {preview ? (
        <PreviewOverlay
          meta={meta}
          seller={seller}
          buyer={buyer}
          items={items}
          calc={calc}
          taxMode={taxMode}
          onPatchItem={patchItem}
          onBeginTotalEdit={beginTotalEdit}
          onSetTotal={setTotal}
          onClose={() => setPreview(false)}
          onSave={() => save(false)}
          onPrint={async () => {
            const ok = await save(false)
            if (ok) onPrint({ meta, buyer, items, taxMode })
          }}
        />
      ) : null}

      <Modal
        open={addCompany}
        onClose={() => setAddCompany(false)}
        title="Add a company"
        subtitle="Saved to the list — pick it from the dropdown next time."
      >
        <CompanyForm
          homeState={seller.state}
          onCancel={() => setAddCompany(false)}
          onSave={async (c) => {
            await saveCompany(c)
            onCompaniesChanged()
            setBuyerId(c.id)
            setOverride(null)
            setAddCompany(false)
          }}
        />
      </Modal>

      <Modal
        open={editCompany && !!buyer}
        onClose={() => setEditCompany(false)}
        title="Edit company"
        subtitle="Changes are saved to the company list and show on this bill straight away."
      >
        {buyer ? (
          <CompanyForm
            initial={buyer}
            homeState={seller.state}
            onCancel={() => setEditCompany(false)}
            onSave={async (c) => {
              await saveCompany(c)
              onCompaniesChanged()
              setBuyerId(c.id)
              setEditCompany(false)
              say('ok', `${c.name} updated.`)
            }}
          />
        ) : null}
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ preview */

function PreviewOverlay({
  meta,
  seller,
  buyer,
  items,
  calc,
  taxMode,
  onPatchItem,
  onBeginTotalEdit,
  onSetTotal,
  onClose,
  onSave,
  onPrint,
}: {
  meta: InvoiceMeta
  seller: Seller
  buyer: Company | null
  items: InvoiceItem[]
  calc: ReturnType<typeof calcInvoice>
  taxMode: TaxMode
  onPatchItem: (lineId: string, patch: Partial<InvoiceItem>) => void
  onBeginTotalEdit: () => void
  onSetTotal: (target: number, which: 'sub' | 'grand') => void
  onClose: () => void
  onSave: () => void
  onPrint: () => void
}) {
  const pdfRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<'pdf' | 'share' | null>(null)
  const [toast, setToast] = useState('')

  const fileName = invoiceFileName(meta.invoiceNo || 'draft', buyer?.name ?? '')

  const buildPdf = async () => {
    const node = pdfRef.current
    if (!node) throw new Error('nothing to render')
    return invoiceToPdfBlob(node)
  }

  const flash = (t: string) => {
    setToast(t)
    window.setTimeout(() => setToast(''), 4000)
  }

  const savePdf = async () => {
    setBusy('pdf')
    try {
      downloadBlob(await buildPdf(), fileName)
      flash(`Saved ${fileName}`)
    } catch {
      flash('Could not build the PDF. Use Save & Print and choose “Save as PDF”.')
    } finally {
      setBusy(null)
    }
  }

  const shareOnWhatsapp = async () => {
    setBusy('share')
    try {
      const message = [
        `Tax Invoice ${meta.invoiceNo || ''}`.trim(),
        `from ${seller.name}`,
        `Total ${money(calc.grandTotal)}`,
      ].join(' — ')
      const how = await sharePdf(await buildPdf(), fileName, message, buyer?.phone)
      if (how === 'downloaded-and-opened') {
        flash(`${fileName} downloaded — attach it in the WhatsApp tab that just opened.`)
      } else if (how === 'shared') {
        flash('Shared.')
      }
    } catch {
      flash('Could not build the PDF to share.')
    } finally {
      setBusy(null)
    }
  }

  return createPortal(
    <div className="anim-fade fixed inset-0 z-50 flex flex-col bg-bone">
      <header className="flex flex-wrap items-center gap-4 border-b border-line bg-card px-6 py-3.5">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-bold text-ink-2 transition-colors hover:bg-bone-2 hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to bill
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">
            Settle the price
          </h2>
          <p className="truncate text-[12.5px] text-muted">
            Click any quantity, rate or amount on the bill and type the agreed figure — GST and the
            total follow it.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={savePdf} disabled={busy !== null}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v11m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {busy === 'pdf' ? 'Saving…' : 'Save PDF'}
          </Button>
          <Button variant="ghost" size="sm" onClick={shareOnWhatsapp} disabled={busy !== null}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M20.5 11.5a8.5 8.5 0 01-12.6 7.4L3.5 20.5l1.7-4.3A8.5 8.5 0 1120.5 11.5z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M8.8 8.4c.3-.7.6-.7.9-.700000001.2 0 .5 0 .7.4l.6 1.3c.1.3 0 .5-.1.7l-.4.5c-.1.2-.2.4 0 .7.5.8 1.3 1.5 2.2 1.9.3.1.5.1.7-.1l.5-.5c.2-.2.4-.2.6-.1l1.3.7c.3.2.4.4.4.6 0 .4-.2.9-.9 1.2-.6.3-1.4.3-2.3 0a8 8 0 01-4.4-4.1c-.4-.9-.4-1.8-.1-2.4z"
                fill="currentColor"
              />
            </svg>
            {busy === 'share' ? 'Preparing…' : 'WhatsApp'}
          </Button>
          <Button variant="outline" size="sm" onClick={onSave}>
            Save
          </Button>
          <Button size="sm" onClick={onPrint}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8v-7z"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Save &amp; Print
          </Button>
        </div>
      </header>

      <div className="scroll-thin flex min-h-0 flex-1 flex-col-reverse overflow-y-auto xl:flex-row xl:overflow-hidden">
        <div className="scroll-thin flex-1 overflow-y-auto bg-bone-2/60 px-6 py-8">
          <div className="mx-auto w-[734px] max-w-full">
            <InvoiceDocument
              meta={meta}
              seller={seller}
              buyer={buyer}
              items={items}
              calc={calc}
              editable
              onPatchItem={onPatchItem}
              onBeginTotalEdit={onBeginTotalEdit}
              onSetTotal={onSetTotal}
              className="inv-screen anim-rise"
            />
          </div>
        </div>

        <aside className="scroll-thin w-full shrink-0 overflow-y-auto border-l border-line bg-card px-5 py-6 xl:w-[350px]">
          <div className="mb-5 flex items-center gap-2.5">
            {taxMode === 'intra' ? (
              <Pill tone="sage">CGST + SGST</Pill>
            ) : (
              <Pill tone="copper">IGST</Pill>
            )}
            <span className="text-[12px] text-muted">{buyer?.state}</span>
          </div>

          <div className="space-y-2 text-[13.5px]">
            <Row label="Sub Total" value={plain(calc.subTotal)} />
            {taxMode === 'intra' ? (
              <>
                <Row label="CGST" value={plain(calc.cgst)} />
                <Row label="SGST" value={plain(calc.sgst)} />
              </>
            ) : (
              <Row label="IGST" value={plain(calc.igst)} />
            )}
            <Row label="Rounded Off" value={plain(calc.roundOff)} />
          </div>

          <div className="mt-5 rounded-[18px] bg-espresso px-5 py-5 text-bone">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-bone/45">
              Total payable
            </div>
            <div className="mt-1 font-display text-[30px] font-semibold leading-none text-copper-2">
              {money(calc.grandTotal)}
            </div>
            <div className="mt-1.5 text-[11.5px] text-bone/50">
              incl. {plain(calc.totalTax)} tax on {plain(calc.subTotal)}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted">
              GST, separated
            </h3>
            <div className="overflow-hidden rounded-xl2 border border-line">
              <HsnTable calc={calc} compact />
            </div>
          </div>

          <p className="mt-5 text-[12px] leading-relaxed text-muted">
            Type over any quantity, rate or amount. Putting a figure on <b>Sub Total</b> or{' '}
            <b>Total</b> spreads it back across the lines in proportion.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Changes affect this bill only — the catalogue rate stays as it is.
          </p>
        </aside>
      </div>

      {toast ? (
        <div className="anim-rise pointer-events-none fixed bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-espresso px-5 py-3 text-[13px] font-semibold text-bone shadow-[0_18px_40px_-14px_rgba(30,21,16,0.7)]">
          {toast}
        </div>
      ) : null}

      {/* Plain copy of the bill, off-screen, rendered to PNG for the PDF so the
          exported file never shows the bargaining underlines. */}
      <div
        ref={pdfRef}
        aria-hidden
        style={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: '194mm',
          background: '#fff',
          zIndex: -1,
        }}
      >
        <InvoiceDocument meta={meta} seller={seller} buyer={buyer} items={items} calc={calc} />
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------- pieces */

function HsnTable({
  calc,
  compact = false,
}: {
  calc: ReturnType<typeof calcInvoice>
  compact?: boolean
}) {
  const intra = calc.taxMode === 'intra'
  const pad = compact ? 'pl-3' : 'pl-6'
  const padR = compact ? 'pr-3' : 'pr-6'

  return (
    <table className={`w-full ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
      <thead>
        <tr className="border-b border-line text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
          <th className={`py-2.5 ${pad} text-left`}>HSN/SAC</th>
          <th className="py-2.5 text-right">Taxable</th>
          {intra ? (
            <>
              <th className="py-2.5 text-right">CGST</th>
              <th className={`py-2.5 ${padR} text-right`}>SGST</th>
            </>
          ) : (
            <th className={`py-2.5 ${padR} text-right`}>IGST</th>
          )}
        </tr>
      </thead>
      <tbody>
        {calc.hsnRows.map((r) => (
          <tr key={`${r.hsn}-${r.gstRate}`} className="border-b border-line/60">
            <td className={`py-2 ${pad} font-mono text-[12px] text-ink`}>{r.hsn}</td>
            <td className="py-2 text-right tabular-nums">{plain(r.taxable)}</td>
            {intra ? (
              <>
                <td className="py-2 text-right tabular-nums">{plain(r.cgst)}</td>
                <td className={`py-2 ${padR} text-right tabular-nums`}>{plain(r.sgst)}</td>
              </>
            ) : (
              <td className={`py-2 ${padR} text-right tabular-nums`}>{plain(r.igst)}</td>
            )}
          </tr>
        ))}
        <tr className="font-bold text-ink">
          <td className={`py-2.5 ${pad}`}>Total</td>
          <td className="py-2.5 text-right tabular-nums">{plain(calc.subTotal)}</td>
          {intra ? (
            <>
              <td className="py-2.5 text-right tabular-nums">{plain(calc.cgst)}</td>
              <td className={`py-2.5 ${padR} text-right tabular-nums`}>{plain(calc.sgst)}</td>
            </>
          ) : (
            <td className={`py-2.5 ${padR} text-right tabular-nums`}>{plain(calc.igst)}</td>
          )}
        </tr>
      </tbody>
    </table>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-2">{label}</span>
      <span className="font-bold tabular-nums text-ink">{value}</span>
    </div>
  )
}
