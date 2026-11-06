import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Invoice, Seller } from '../lib/types'
import { calcInvoice } from '../lib/gst'
import { billDate, byBillOrder, financialYear, monthName } from '../lib/invoiceNo'
import { downloadBlob, invoicesToPdfBlob } from '../lib/pdf'
import InvoiceDocument from './InvoiceDocument'
import { Button, Card, Empty, Input } from './ui'

/**
 * Year → month → bills, shared by the Invoices and Repeat Bill screens.
 *
 * They keep these for years, so a flat list stops being usable quickly. The
 * year buttons sit above whatever each screen shows by default, and drilling
 * in narrows the search box with you: on the front page it searches
 * everything, inside a year only that year, inside a month only that month.
 *
 * Within a month bills run first-of-the-month first — the order they were
 * written — not newest first.
 */

/** Months in financial-year order: April through March. */
const FY_MONTH_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2]

export interface ArchiveProps {
  invoices: Invoice[]
  seller: Seller
  /** how each screen draws one bill */
  renderRow: (inv: Invoice) => ReactNode
  /** shown on the front page, under the year buttons */
  children: ReactNode
  searchPlaceholder: string
  /** the month view offers the whole month as one PDF */
  allowMonthPdf?: boolean
}

export default function BillArchive({
  invoices,
  seller,
  renderRow,
  children,
  searchPlaceholder,
  allowMonthPdf = false,
}: ArchiveProps) {
  const [q, setQ] = useState('')
  const [year, setYear] = useState<string | null>(null)
  const [month, setMonth] = useState<number | null>(null)

  const dated = useMemo(
    () => invoices.map((inv) => ({ inv, d: billDate(inv) })),
    [invoices],
  )

  const years = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { d } of dated) {
      const fy = financialYear(d)
      counts.set(fy, (counts.get(fy) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [dated])

  const inYear = useMemo(
    () => (year ? dated.filter(({ d }) => financialYear(d) === year) : []),
    [dated, year],
  )

  const months = useMemo(() => {
    const counts = new Map<number, number>()
    for (const { d } of inYear) counts.set(d.getMonth(), (counts.get(d.getMonth()) ?? 0) + 1)
    return FY_MONTH_ORDER.filter((m) => counts.has(m)).map((m) => ({ m, n: counts.get(m)! }))
  }, [inYear])

  const inMonth = useMemo(
    () =>
      month === null
        ? []
        : inYear.filter(({ d }) => d.getMonth() === month).map(({ inv }) => inv).sort(byBillOrder),
    [inYear, month],
  )

  /** Search only ever covers the level you are standing on. */
  const scope: Invoice[] = useMemo(() => {
    if (month !== null) return inMonth
    if (year !== null) return inYear.map(({ inv }) => inv).sort(byBillOrder)
    return invoices
  }, [invoices, inYear, inMonth, year, month])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return scope.filter(
      (i) =>
        i.meta.invoiceNo.toLowerCase().includes(s) ||
        i.buyer.name.toLowerCase().includes(s) ||
        i.buyer.state.toLowerCase().includes(s) ||
        i.meta.customerPoNo.toLowerCase().includes(s) ||
        i.items.some((it) => it.description.toLowerCase().includes(s) || it.hsn.includes(s)),
    )
  }, [scope, q])

  const scopeLabel =
    month !== null ? `${monthName(month)} ${year}` : year !== null ? year : 'all bills'

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={month !== null || year !== null ? `Search in ${scopeLabel}…` : searchPlaceholder}
          />
        </div>
        {q ? (
          <span className="text-[12.5px] text-muted">
            {results.length} match{results.length === 1 ? '' : 'es'} in {scopeLabel}
          </span>
        ) : null}
      </div>

      {/* --------------------------------------------------------- trail */}
      {year !== null ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
          <Crumb
            onClick={() => {
              setYear(null)
              setMonth(null)
            }}
          >
            All years
          </Crumb>
          <Arrow />
          {month === null ? (
            <span className="font-bold text-ink">{year}</span>
          ) : (
            <>
              <Crumb onClick={() => setMonth(null)}>{year}</Crumb>
              <Arrow />
              <span className="font-bold text-ink">{monthName(month)}</span>
            </>
          )}
        </div>
      ) : null}

      {/* ------------------------------------------------------ year row */}
      {year === null && !q ? (
        years.length > 0 ? (
          <div className="mb-6">
            <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
              By year
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {years.map(([fy, n]) => (
                <button
                  key={fy}
                  onClick={() => setYear(fy)}
                  className="group rounded-xl2 border border-line bg-card px-5 py-3 text-left transition-all duration-200
                    hover:-translate-y-0.5 hover:border-copper hover:shadow-[0_14px_28px_-18px_rgba(180,113,58,0.9)]"
                >
                  <span className="block font-display text-[17px] font-semibold leading-tight text-ink">
                    {fy}
                  </span>
                  <span className="block text-[11.5px] text-muted">
                    {n} bill{n === 1 ? '' : 's'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null
      ) : null}

      {/* ------------------------------------------------------- content */}
      {q ? (
        results.length === 0 ? (
          <Card>
            <Empty title={`Nothing matches “${q}”`} note={`Searched ${scopeLabel}.`} />
          </Card>
        ) : (
          <div className="stagger space-y-3">{results.map(renderRow)}</div>
        )
      ) : year === null ? (
        children
      ) : month === null ? (
        <div className="flex flex-wrap gap-2.5">
          {months.map(({ m, n }) => (
            <button
              key={m}
              onClick={() => setMonth(m)}
              className="group rounded-xl2 border border-line bg-card px-5 py-3.5 text-left transition-all duration-200
                hover:-translate-y-0.5 hover:border-copper hover:shadow-[0_14px_28px_-18px_rgba(180,113,58,0.9)]"
            >
              <span className="block font-display text-[16px] font-semibold leading-tight text-ink">
                {monthName(m)}
              </span>
              <span className="block text-[11.5px] text-muted">
                {n} bill{n === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {allowMonthPdf ? (
            <MonthPdf bills={inMonth} seller={seller} label={`${monthName(month)}-${year}`} />
          ) : null}
          <div className="stagger space-y-3">{inMonth.map(renderRow)}</div>
        </>
      )}
    </>
  )
}

/* ----------------------------------------------------------- month export */

function MonthPdf({
  bills,
  seller,
  label,
}: {
  bills: Invoice[]
  seller: Seller
  label: string
}) {
  const holder = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [note, setNote] = useState('')

  /*
    The off-screen copies are only mounted while an export is running. Keeping
    a month's worth of full invoice documents in the tree the whole time is a
    lot of DOM for a button nobody has pressed yet.
  */
  useEffect(() => {
    if (!busy) return
    let cancelled = false

    const run = async () => {
      try {
        // two frames: one for React to commit, one for layout to settle
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
        if (cancelled) return
        const nodes = [...(holder.current?.querySelectorAll<HTMLElement>('[data-bill]') ?? [])]
        if (!nodes.length) throw new Error('nothing to export')
        const blob = await invoicesToPdfBlob(nodes, (n) => !cancelled && setDone(n))
        if (cancelled) return
        downloadBlob(blob, `Bills-${label.replace(/\s+/g, '-')}.pdf`)
        setNote(`${bills.length} bill${bills.length === 1 ? '' : 's'} saved as one PDF.`)
      } catch {
        if (!cancelled) {
          setNote('Could not build the PDF. Try a smaller month, or print the bills one by one.')
        }
      } finally {
        if (!cancelled) {
          setBusy(false)
          window.setTimeout(() => setNote(''), 5000)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [busy, bills.length, label])

  const build = () => {
    setDone(0)
    setNote('')
    setBusy(true)
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl2 border border-line bg-bone px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-ink">
          {bills.length} bill{bills.length === 1 ? '' : 's'} this month
        </div>
        <div className="text-[12px] text-muted">
          {busy
            ? `Building page ${done} of ${bills.length}…`
            : note || 'Download the whole month as one PDF to send for GST review.'}
        </div>
      </div>
      <Button size="sm" onClick={build} disabled={busy}>
        {busy ? `${done}/${bills.length}` : 'Download month PDF'}
      </Button>

      {/* off-screen copies, rendered plain, captured page by page */}
      <div
        ref={holder}
        aria-hidden
        style={{ position: 'fixed', left: '-10000px', top: 0, width: '186mm', zIndex: -1 }}
      >
        {(busy ? bills : []).map((inv) => (
          <div data-bill key={inv.id} style={{ background: '#fff' }}>
            <InvoiceDocument
              meta={inv.meta}
              seller={seller}
              buyer={inv.buyer}
              items={inv.items}
              calc={calcInvoice(inv.items, inv.taxMode)}
              signature={inv.showSignature === false ? null : seller.signature ?? null}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ bits */

function Crumb({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-2.5 py-1 font-semibold text-ink-2 transition-colors hover:bg-bone-2 hover:text-copper"
    >
      {children}
    </button>
  )
}

function Arrow() {
  return <span className="text-muted">›</span>
}
