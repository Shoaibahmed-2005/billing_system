import { useMemo, useState } from 'react'
import type { Company, Invoice, InvoiceItem, InvoiceMeta, TaxMode } from '../lib/types'
import { calcInvoice } from '../lib/gst'
import { money } from '../lib/format'
import { deleteInvoice } from '../lib/store'
import { Button, Card, Empty, Input, Pill } from '../components/ui'

export default function InvoicesPage({
  invoices,
  onChanged,
  onEdit,
  onRepeat,
  onPrint,
}: {
  invoices: Invoice[]
  onChanged: () => void
  onEdit: (inv: Invoice) => void
  onRepeat: (inv: Invoice) => void
  onPrint: (payload: {
    meta: InvoiceMeta
    buyer: Company | null
    items: InvoiceItem[]
    taxMode: TaxMode
  }) => void
}) {
  const [q, setQ] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return invoices
    return invoices.filter(
      (i) =>
        i.meta.invoiceNo.toLowerCase().includes(s) ||
        i.buyer.name.toLowerCase().includes(s) ||
        i.meta.customerPoNo.toLowerCase().includes(s),
    )
  }, [invoices, q])

  return (
    <div className="anim-rise">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
            Invoices
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {invoices.length} saved bill{invoices.length === 1 ? '' : 's'} — reprint any of them as-is.
          </p>
        </div>
        <div className="w-72">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoice no., company or PO…"
          />
        </div>
      </header>

      {list.length === 0 ? (
        <Card>
          <Empty
            title={invoices.length === 0 ? 'No bills yet' : 'Nothing matches that search'}
            note={
              invoices.length === 0
                ? 'Saved bills appear here with their items and totals intact.'
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="stagger space-y-3">
          {list.map((inv) => {
            const calc = calcInvoice(inv.items, inv.taxMode)
            return (
              <Card
                key={inv.id}
                className="group transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[0_18px_34px_-24px_rgba(42,32,24,0.55)]"
              >
                <div className="flex flex-wrap items-center gap-5 px-6 py-4">
                  <div className="min-w-[150px]">
                    <div className="font-display text-[18px] font-semibold leading-tight text-ink">
                      {inv.meta.invoiceNo}
                    </div>
                    <div className="text-[12px] text-muted">{inv.meta.dated}</div>
                  </div>

                  <div className="min-w-[210px] flex-1">
                    <div className="text-[14px] font-bold text-ink">{inv.buyer.name}</div>
                    <div className="text-[12px] text-muted">
                      {inv.buyer.state} · {inv.items.length} item
                      {inv.items.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div>
                    {inv.taxMode === 'intra' ? (
                      <Pill tone="sage">CGST + SGST</Pill>
                    ) : (
                      <Pill tone="copper">IGST</Pill>
                    )}
                  </div>

                  <div className="min-w-[120px] text-right">
                    <div className="font-display text-[19px] font-semibold text-ink">
                      {money(calc.grandTotal)}
                    </div>
                    <div className="text-[11.5px] text-muted">tax {money(calc.totalTax)}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(inv)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onRepeat(inv)}>
                      Use again
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onPrint({
                          meta: inv.meta,
                          buyer: inv.buyer,
                          items: inv.items,
                          taxMode: inv.taxMode,
                        })
                      }
                    >
                      Print
                    </Button>
                    {confirmId === inv.id ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          await deleteInvoice(inv.id)
                          setConfirmId(null)
                          onChanged()
                        }}
                      >
                        Confirm
                      </Button>
                    ) : (
                      <button
                        onClick={() => setConfirmId(inv.id)}
                        aria-label="Delete invoice"
                        className="grid h-9 w-9 place-items-center rounded-full text-muted opacity-0 transition-all
                          group-hover:opacity-100 hover:bg-clay/12 hover:text-clay focus:opacity-100"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
