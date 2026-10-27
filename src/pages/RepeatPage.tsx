import { useMemo, useState } from 'react'
import type { Invoice } from '../lib/types'
import { calcInvoice } from '../lib/gst'
import { money } from '../lib/format'
import { Button, Card, Empty, Input, Pill } from '../components/ui'

/**
 * Repeat Bill — for the companies that buy the same handful of parts over and
 * over. Pick one of their earlier bills, and it opens as a fresh copy: same
 * items and prices, ready for a new invoice number. Saving it files a new bill;
 * the original is left untouched.
 */
export default function RepeatPage({
  invoices,
  onRepeat,
}: {
  invoices: Invoice[]
  onRepeat: (inv: Invoice) => void
}) {
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase()

    const matches = (inv: Invoice) =>
      !s ||
      inv.buyer.name.toLowerCase().includes(s) ||
      inv.buyer.state.toLowerCase().includes(s) ||
      inv.meta.invoiceNo.toLowerCase().includes(s) ||
      inv.meta.customerPoNo.toLowerCase().includes(s) ||
      inv.items.some(
        (i) => i.description.toLowerCase().includes(s) || i.hsn.toLowerCase().includes(s),
      )

    const byCompany = new Map<string, Invoice[]>()
    for (const inv of invoices.filter(matches)) {
      const list = byCompany.get(inv.buyer.name) ?? []
      list.push(inv)
      byCompany.set(inv.buyer.name, list)
    }

    return [...byCompany.entries()]
      .map(([name, list]) => ({
        name,
        state: list[0].buyer.state,
        bills: [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [invoices, q])

  const shown = groups.reduce((n, g) => n + g.bills.length, 0)

  return (
    <div className="anim-rise">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
            Repeat Bill
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            Sell the same parts again without retyping them — pick an earlier bill and it opens as a
            fresh copy.
          </p>
        </div>
        <div className="w-80">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, invoice no., PO or a product…"
          />
        </div>
      </header>

      {invoices.length === 0 ? (
        <Card>
          <Empty
            title="No saved bills yet"
            note="Once you save a bill it shows up here, ready to be sent out again."
          />
        </Card>
      ) : shown === 0 ? (
        <Card>
          <Empty title={`Nothing matches “${q}”`} note="Try a company name or a part name." />
        </Card>
      ) : (
        <div className="stagger space-y-5">
          {groups.map((g) => (
            <Card key={g.name} className="overflow-hidden">
              <header className="flex items-center justify-between gap-4 border-b border-line bg-bone/60 px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-[18px] font-semibold leading-tight text-ink">
                    {g.name}
                  </h2>
                  <span className="text-[12px] text-muted">{g.state}</span>
                </div>
                <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
                  {g.bills.length} past bill{g.bills.length === 1 ? '' : 's'}
                </span>
              </header>

              {g.bills.map((inv) => {
                const calc = calcInvoice(inv.items, inv.taxMode)
                const names = inv.items.map((i) => i.description)
                return (
                  <div
                    key={inv.id}
                    className="group flex flex-wrap items-center gap-4 border-b border-line/60 px-6 py-3.5 transition-colors last:border-0 hover:bg-bone/70"
                  >
                    <div className="min-w-[130px]">
                      <div className="text-[14px] font-bold text-ink">{inv.meta.invoiceNo}</div>
                      <div className="text-[12px] text-muted">{inv.meta.dated}</div>
                    </div>

                    <div className="min-w-[220px] flex-1">
                      <div className="truncate text-[12.5px] text-ink-2">
                        {names.slice(0, 3).join(' · ')}
                        {names.length > 3 ? ` · +${names.length - 3} more` : ''}
                      </div>
                      <div className="text-[11.5px] text-muted">
                        {inv.items.length} item{inv.items.length === 1 ? '' : 's'}
                      </div>
                    </div>

                    {inv.taxMode === 'intra' ? (
                      <Pill tone="sage">CGST + SGST</Pill>
                    ) : (
                      <Pill tone="copper">IGST</Pill>
                    )}

                    <div className="min-w-[110px] text-right">
                      <div className="font-display text-[17px] font-semibold text-ink">
                        {money(calc.grandTotal)}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => onRepeat(inv)}
                      className="transition-transform duration-200 group-hover:-translate-y-0.5"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 9a8 8 0 0113.7-5.7L20 5.5M20 15a8 8 0 01-13.7 5.7L4 18.5M20 3.5v4h-4M4 20.5v-4h4"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Use again
                    </Button>
                  </div>
                )
              })}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
