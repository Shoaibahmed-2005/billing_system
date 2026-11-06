import { useMemo, useState } from 'react'
import type { Company, Invoice, InvoiceItem, InvoiceMeta, Seller, TaxMode } from '../lib/types'
import { calcInvoice } from '../lib/gst'
import { money } from '../lib/format'
import { byBillOrder } from '../lib/invoiceNo'
import { deleteInvoice } from '../lib/store'
import BillArchive from '../components/BillArchive'
import { Button, Card, Empty, Pill } from '../components/ui'

/** How many of the latest bills the front page shows before the year buttons take over. */
const RECENT = 15

export default function InvoicesPage({
  invoices,
  seller,
  onChanged,
  onEdit,
  onRepeat,
  onPrint,
}: {
  invoices: Invoice[]
  seller: Seller
  onChanged: () => void
  onEdit: (inv: Invoice) => void
  onRepeat: (inv: Invoice) => void
  onPrint: (payload: {
    meta: InvoiceMeta
    buyer: Company | null
    items: InvoiceItem[]
    taxMode: TaxMode
    showSignature: boolean
  }) => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const recent = useMemo(
    () => [...invoices].sort(byBillOrder).reverse().slice(0, RECENT),
    [invoices],
  )

  const row = (inv: Invoice) => {
    const calc = calcInvoice(inv.items, inv.taxMode)
    return (
      <Card
        key={inv.id}
        className="group transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[0_18px_34px_-24px_rgba(42,32,24,0.55)]"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-6">
          <div className="min-w-[150px]">
            <div className="font-display text-[18px] font-semibold leading-tight text-ink">
              {inv.meta.invoiceNo}
            </div>
            <div className="text-[12px] text-muted">{inv.meta.dated}</div>
          </div>

          <div className="min-w-[210px] flex-1">
            <div className="text-[14px] font-bold text-ink">{inv.buyer.name}</div>
            <div className="text-[12px] text-muted">
              {inv.buyer.state} · {inv.items.length} item{inv.items.length === 1 ? '' : 's'}
            </div>
          </div>

          <div>
            {inv.taxMode === 'intra' ? (
              <Pill tone="sage">CGST + SGST</Pill>
            ) : (
              <Pill tone="copper">IGST</Pill>
            )}
          </div>

          <div className="ml-auto min-w-[110px] text-right sm:ml-0">
            <div className="font-display text-[19px] font-semibold text-ink">
              {money(calc.grandTotal)}
            </div>
            <div className="text-[11.5px] text-muted">tax {money(calc.totalTax)}</div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
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
                  showSignature: inv.showSignature ?? true,
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
                className="grid h-9 w-9 place-items-center rounded-full text-muted transition-all
                  hover:bg-clay/12 hover:text-clay lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
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
  }

  return (
    <div className="anim-rise">
      <header className="mb-6">
        <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
          Invoices
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          {invoices.length} saved bill{invoices.length === 1 ? '' : 's'} — search across all of
          them, or open a year and work month by month.
        </p>
      </header>

      <BillArchive
        invoices={invoices}
        seller={seller}
        renderRow={row}
        allowMonthPdf
        searchPlaceholder="Search any company, invoice no., PO or product…"
      >
        {invoices.length === 0 ? (
          <Card>
            <Empty
              title="No bills yet"
              note="Saved bills appear here with their items and totals intact."
            />
          </Card>
        ) : (
          <>
            <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
              Recent bills
            </h2>
            <div className="stagger space-y-3">{recent.map(row)}</div>
            {invoices.length > RECENT ? (
              <p className="mt-4 text-[12.5px] text-muted">
                Showing the latest {RECENT}. Use a year above, or the search box, for the rest.
              </p>
            ) : null}
          </>
        )}
      </BillArchive>
    </div>
  )
}
