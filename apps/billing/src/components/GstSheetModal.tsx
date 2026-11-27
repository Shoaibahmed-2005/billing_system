import { useEffect, useMemo, useRef, useState } from 'react'
import type { Invoice } from '@naveen/shared/types'
import {
  GST_HEADERS,
  gstFileName,
  gstRows,
  gstSheetTitle,
  gstWorkbook,
  type GstRow,
} from '../lib/gstSheet'
import { downloadBlob } from '@naveen/shared/pdf'
import { plain } from '@naveen/shared/format'
import { Button, Modal } from '@naveen/shared/ui'

/**
 * The month's GST sheet, on screen before it is downloaded.
 *
 * They asked to see it rather than have it land in the downloads folder
 * unseen, which is fair: the whole file goes to their accountant, and the
 * cost of a wrong month is a phone call. What is drawn here comes from the
 * same rows the spreadsheet is built from, so the check is a real one.
 *
 * All sixteen columns are here, the same sixteen the file carries, and the
 * table slides sideways to reach them. Total Amount After tax is pinned to
 * the right edge, because that is the figure being checked and it is the one
 * column that must never be the one scrolled out of sight. Slide all the way
 * across and it settles back into its own place at the end of the row, which
 * is how you can tell you have reached the end.
 *
 * It was a block per bill on a phone for a while, to avoid a wide table on a
 * small screen. The client would rather slide.
 */
const money = (n: number | null) => (n === null ? '' : plain(n))
const pct = (n: number | null) => (n === null ? '' : `${n}%`)

/** The figures of one row, in the order of GST_HEADERS. */
const cells = (r: GstRow): string[] =>
  r.isTotal
    ? [...Array<string>(15).fill(''), money(r.total)]
    : [
        r.sl,
        r.buyer,
        r.invoiceNo,
        r.date,
        r.gstin,
        r.hsn,
        r.uqm,
        r.qty === null ? '' : String(r.qty),
        money(r.amount),
        pct(r.halfPct),
        money(r.cgst),
        pct(r.halfPct),
        money(r.sgst),
        pct(r.igstPct),
        money(r.igst),
        money(r.total),
      ]

/** Everything from Amont rightwards is a figure, so it sits to the right. */
const RIGHT_FROM = 8

export default function GstSheetModal({
  open,
  onClose,
  bills,
  month,
  calendarYear,
}: {
  open: boolean
  onClose: () => void
  bills: Invoice[]
  month: number
  calendarYear: number
}) {
  const rows = useMemo(() => (open ? gstRows(bills) : []), [open, bills])
  const scroller = useRef<HTMLDivElement>(null)

  /*
    The pinned column is given an edge shadow only while there is something
    hidden behind it. At the far right it has nothing left to cover, so the
    shadow goes and the column reads as an ordinary last column again.
  */
  const [floating, setFloating] = useState(false)
  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    setFloating(el.scrollWidth - el.clientWidth - el.scrollLeft > 1)
  }

  // and it needs the shadow from the moment it opens, not from the first drag
  useEffect(onScroll, [open, rows.length])

  const count = rows.filter((r) => r.isTotal).length
  const total = rows.reduce((s, r) => (r.isTotal ? s + r.total : s), 0)

  /*
    Inline rather than a utility class: an arbitrary shadow whose value
    carries its own rgba() came out transparent, so the pinned column had
    nothing to separate it from the figures sliding under it.
  */
  const pin = floating ? { boxShadow: '-11px 0 13px -11px rgba(42, 32, 24, 0.4)' } : undefined

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={gstSheetTitle(month, calendarYear)}
      subtitle={`${count} bill${count === 1 ? '' : 's'} · ${plain(total)} after tax`}
      width="max-w-5xl"
    >
      <div
        ref={scroller}
        onScroll={onScroll}
        className="max-h-[58vh] overflow-auto rounded-xl2 border border-line"
      >
        <table className="w-max border-collapse text-[12.5px]">
          <thead>
            <tr>
              {GST_HEADERS.map((h, i) => {
                const last = i === GST_HEADERS.length - 1
                return (
                  <th
                    key={i}
                    style={last ? pin : undefined}
                    className={`sticky top-0 whitespace-nowrap border-b border-line bg-bone px-2.5 py-2 font-bold text-ink
                      ${i >= RIGHT_FROM ? 'text-right' : 'text-left'}
                      ${last ? 'right-0 z-20 border-l border-line' : 'z-10'}`}
                  >
                    {h.trim()}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const bg = r.isTotal ? 'bg-bone-2' : 'bg-card'
              return (
                <tr key={i} className={r.isTotal ? 'font-bold' : ''}>
                  {cells(r).map((v, j) => {
                    const last = j === GST_HEADERS.length - 1
                    return (
                      <td
                        key={j}
                        style={last ? pin : undefined}
                        className={`whitespace-nowrap border-b border-line/60 px-2.5 py-1.5 ${bg}
                          ${j >= RIGHT_FROM ? 'text-right tabular-nums' : 'text-left'}
                          ${j === 0 || j === 1 || last ? 'text-ink' : 'text-muted'}
                          ${last ? 'sticky right-0 z-10 border-l border-line' : ''}`}
                      >
                        {v}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="order-2 text-[12px] text-muted sm:order-1 sm:max-w-sm">
          Slide the table sideways for the rest — the total stays with you. The file carries these
          same sixteen columns; it saves to the device, and opens there in Excel.
        </p>
        <Button
          size="sm"
          className="order-1 w-full sm:order-2 sm:w-auto"
          onClick={() => downloadBlob(gstWorkbook(bills), gstFileName(month, calendarYear))}
        >
          Download Excel
        </Button>
      </div>
    </Modal>
  )
}
