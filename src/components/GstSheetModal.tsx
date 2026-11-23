import { useMemo } from 'react'
import type { Invoice } from '../lib/types'
import {
  GST_HEADERS,
  gstFileName,
  gstRows,
  gstSheetTitle,
  gstWorkbook,
  type GstRow,
} from '../lib/gstSheet'
import { downloadBlob } from '../lib/pdf'
import { plain } from '../lib/format'
import { Button, Modal } from './ui'

/**
 * The month's GST sheet, on screen before it is downloaded.
 *
 * They asked to see it rather than have it land in the downloads folder
 * unseen, which is fair: the whole file goes to their accountant, and the
 * cost of a wrong month is a phone call. What is drawn here comes from the
 * same rows the spreadsheet is built from, so the check is a real one.
 *
 * Two layouts, because a sixteen-column sheet cannot be made honest on a
 * phone. On a laptop it is the table, which is what they are used to reading.
 * On a phone a wide table only scrolls the money off the side of the screen,
 * so each bill becomes a block instead, with its lines under it and its total
 * at the foot. The file itself carries all sixteen columns either way.
 */
const money = (n: number | null) => (n === null ? '' : plain(n))

/** The rows regrouped into one block per bill, for the phone layout. */
interface Block {
  head: GstRow
  lines: GstRow[]
  total: number
}

const blocksOf = (rows: GstRow[]): Block[] => {
  const out: Block[] = []
  let lines: GstRow[] = []
  for (const r of rows) {
    if (r.isTotal) {
      if (lines.length) out.push({ head: lines[0], lines, total: r.total })
      lines = []
    } else {
      lines.push(r)
    }
  }
  return out
}

/** Sl No, buyer, invoice no, date, Amont, IGST %, IGST Amount, total. */
const COLUMNS = [0, 1, 2, 3, 8, 13, 14, 15]

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
  const blocks = useMemo(() => blocksOf(rows), [rows])
  const total = blocks.reduce((s, b) => s + b.total, 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={gstSheetTitle(month, calendarYear)}
      subtitle={`${blocks.length} bill${blocks.length === 1 ? '' : 's'} · ${plain(total)} after tax`}
      width="max-w-4xl"
    >
      {/* laptop: the sheet as a sheet */}
      <div className="hidden max-h-[58vh] overflow-auto rounded-xl2 border border-line sm:block">
        <table className="w-full border-collapse text-[12.5px]">
          <thead className="sticky top-0 bg-bone">
            <tr>
              {COLUMNS.map((i) => (
                <th
                  key={i}
                  className={`whitespace-nowrap border-b border-line px-2.5 py-2 font-bold text-ink ${
                    i >= 8 ? 'text-right' : 'text-left'
                  }`}
                >
                  {GST_HEADERS[i].trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={r.isTotal ? 'bg-bone/60 font-bold' : ''}>
                <td className="border-b border-line/60 px-2.5 py-1.5 text-ink">{r.sl}</td>
                <td className="border-b border-line/60 px-2.5 py-1.5 text-ink">{r.buyer}</td>
                <td className="whitespace-nowrap border-b border-line/60 px-2.5 py-1.5 text-muted">
                  {r.invoiceNo}
                </td>
                <td className="whitespace-nowrap border-b border-line/60 px-2.5 py-1.5 text-muted">
                  {r.date}
                </td>
                <td className="border-b border-line/60 px-2.5 py-1.5 text-right tabular-nums text-muted">
                  {money(r.amount)}
                </td>
                <td className="border-b border-line/60 px-2.5 py-1.5 text-right text-muted">
                  {r.igstPct === null ? '' : `${r.igstPct}%`}
                </td>
                <td className="border-b border-line/60 px-2.5 py-1.5 text-right tabular-nums text-muted">
                  {money(r.igst)}
                </td>
                <td className="border-b border-line/60 px-2.5 py-1.5 text-right tabular-nums text-ink">
                  {money(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* phone: a block per bill, nothing off the side of the screen */}
      <div className="max-h-[56vh] space-y-2.5 overflow-y-auto sm:hidden">
        {blocks.map((b, i) => (
          <div key={i} className="rounded-xl2 border border-line bg-bone/40 px-3.5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-[14px] font-bold leading-tight text-ink">
                {b.head.buyer}
              </span>
              <span className="shrink-0 text-[11.5px] text-muted">{b.head.sl}</span>
            </div>
            <div className="mt-0.5 text-[12px] text-muted">
              {b.head.invoiceNo} · {b.head.date}
            </div>

            <div className="mt-2 space-y-1 border-t border-line/70 pt-2">
              {b.lines.map((l, j) => (
                <div key={j} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                  <span className="min-w-0 truncate text-muted">
                    {l.hsn}
                    {l.qty === null ? '' : ` · ${l.qty} ${l.uqm}`}
                    {l.igstPct === null ? '' : ` · IGST ${l.igstPct}%`}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink">{money(l.total)}</span>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line/70 pt-2">
              <span className="text-[12px] font-semibold text-muted">Total after tax</span>
              <span className="font-display text-[15px] font-semibold tabular-nums text-ink">
                {money(b.total)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="order-2 text-[12px] text-muted sm:order-1 sm:max-w-sm">
          The file carries all sixteen columns — GST No, HSN, UQM, Quantity and the CGST/SGST pair
          as well. It saves to the device; open it there in Excel.
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
