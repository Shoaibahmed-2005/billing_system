/**
 * The month's sales as the GST sheet the firm already keeps.
 *
 * Their accountant works from a workbook called "June'2026 GST.xlsx" with a
 * SALES tab laid out a particular way, and the whole value of this feature is
 * that what comes out of the website drops straight into that routine. So the
 * headings here are copied from their file character for character — "Invo
 * No", "Amont", the two spaces in "Sl  No " and "SGST  %". They are theirs,
 * not typos to tidy up. So is the red type and the ruled box on every cell.
 *
 * One thing is deliberately not theirs. Their file has a single IGST column
 * carrying the amount, with the rate nowhere; the client asked for the rate
 * and the amount side by side, as CGST and SGST already have. So IGST is two
 * columns here and the sheet runs to P rather than O.
 *
 * The shape of the tab, for anyone changing this later:
 *
 *   one row per line of a bill, with the bill's own details (serial number,
 *   buyer, invoice number, date, GSTIN) written only on its first row, then
 *   a row with nothing but the invoice total in the last column.
 *
 * Tax lands in CGST and SGST for a Tamil Nadu buyer and in IGST for anyone
 * else, which is the same rule the bill itself prints by.
 *
 * The money columns are written as formulas rather than as answers, exactly
 * as their file has them. An accountant who corrects a rate gets a sheet that
 * still adds up.
 */
import type { Invoice } from '@naveen/shared/types'
import { lineAmount } from '@naveen/shared/gst'
import { byBillOrder, monthName } from '@naveen/shared/invoiceNo'
import { buildWorkbook, type Cell, type Row, type Sheet } from '@naveen/shared/xlsx'

export const GST_HEADERS = [
  'Sl  No ',
  'Name of the seller',
  'Invo No',
  'Inv. Date',
  'GST No',
  'HSN Code',
  'UQM',
  'Quantity',
  'Amont',
  'CGST %',
  'CGST Amt',
  'SGST  %',
  'SGST Amount',
  'IGST %',
  'IGST Amount',
  'Total Amount After tax',
]

const WIDTHS = [10, 42, 20, 14, 24, 12, 9, 11, 13, 9, 13, 9, 14, 9, 14, 20]

/** Which column each thing lives in, so the formulas below read as English. */
const AMOUNT = 'I'
const CGST = 'K'
const SGST = 'M'
const IGST = 'O'
const TOTAL = 'P'

export interface GstRow {
  /** the row's own 1-based position in the sheet, headings included */
  r: number
  sl: string
  buyer: string
  invoiceNo: string
  date: string
  gstin: string
  hsn: string
  uqm: string
  qty: number | null
  amount: number | null
  /** half the GST rate on an inside-Tamil-Nadu bill, null on an IGST one */
  halfPct: number | null
  cgst: number | null
  sgst: number | null
  /** the full GST rate on an IGST bill, null otherwise */
  igstPct: number | null
  igst: number | null
  total: number
  /** true on the row that carries nothing but the invoice total */
  isTotal: boolean
  /** on a total row, the span of line rows it adds up */
  from?: number
  to?: number
}

/**
 * Lays the month out row by row, in the order the bills were written.
 *
 * Both the spreadsheet and the on-screen preview are built from this, so what
 * they see before downloading is what the file contains.
 */
export const gstRows = (bills: Invoice[]): GstRow[] => {
  const rows: GstRow[] = []
  let r = 2 // row 1 is the headings
  let sl = 0

  for (const inv of [...bills].sort(byBillOrder)) {
    if (!inv.items.length) continue
    sl++
    const first = r
    const inter = inv.taxMode === 'inter'

    for (const [i, item] of inv.items.entries()) {
      const amount = lineAmount(item)
      const tax = (amount * item.gstRate) / 100

      rows.push({
        r,
        sl: i === 0 ? String(sl) : '',
        buyer: i === 0 ? inv.buyer.name : '',
        invoiceNo: i === 0 ? inv.meta.invoiceNo : '',
        date: i === 0 ? inv.meta.dated : '',
        gstin: i === 0 ? inv.buyer.gstin : '',
        hsn: item.hsn,
        // their sheet leaves both blank on a service line
        uqm: item.kind === 'service' ? '' : item.unit,
        qty: item.kind === 'service' ? null : item.qty,
        amount,
        halfPct: inter ? null : item.gstRate / 2,
        cgst: inter ? null : tax / 2,
        sgst: inter ? null : tax / 2,
        igstPct: inter ? item.gstRate : null,
        igst: inter ? tax : null,
        total: amount + tax,
        isTotal: false,
      })
      r++
    }

    rows.push({
      r,
      sl: '',
      buyer: '',
      invoiceNo: '',
      date: '',
      gstin: '',
      hsn: '',
      uqm: '',
      qty: null,
      amount: null,
      halfPct: null,
      cgst: null,
      sgst: null,
      igstPct: null,
      igst: null,
      total: rows.slice(-inv.items.length).reduce((s, row) => s + row.total, 0),
      isTotal: true,
      from: first,
      to: r - 1,
    })
    r++
  }

  return rows
}

export const gstSheet = (bills: Invoice[]): Sheet => {
  const body: Row[] = gstRows(bills).map((row): Cell[] => {
    // red and ruled, like theirs; the buyer's name and the invoice total bold
    const c = (v: Cell['v'], bold = false): Cell => ({ v, red: true, box: true, bold })
    const f = (formula: string | null, bold = false): Cell =>
      formula ? { f: formula, red: true, box: true, bold } : c(null, bold)

    if (row.isTotal) {
      return [
        ...Array.from({ length: 15 }, () => c(null)),
        f(`SUM(${TOTAL}${row.from}:${TOTAL}${row.to})`, true),
      ]
    }

    const pct = (p: number | null) =>
      p === null ? null : `${AMOUNT}${row.r}/100*${p}`

    return [
      c(row.sl, true),
      c(row.buyer, true),
      c(row.invoiceNo),
      c(row.date),
      c(row.gstin),
      c(row.hsn),
      c(row.uqm),
      c(row.qty),
      c(row.amount),
      c(row.halfPct),
      f(pct(row.halfPct)),
      c(row.halfPct),
      f(pct(row.halfPct)),
      c(row.igstPct),
      f(pct(row.igstPct)),
      f(`${AMOUNT}${row.r}+${CGST}${row.r}+${SGST}${row.r}+${IGST}${row.r}`),
    ]
  })

  return {
    name: 'SALES',
    widths: WIDTHS,
    rows: [GST_HEADERS.map((v): Cell => ({ v, bold: true, box: true })), ...body],
  }
}

export const gstWorkbook = (bills: Invoice[]): Blob => buildWorkbook([gstSheet(bills)])

/**
 * The name their own file carries: "June'2026 GST.xlsx". The year is the
 * calendar year the month falls in, not the financial year.
 */
export const gstFileName = (month: number, calendarYear: number): string =>
  `${monthName(month)}'${calendarYear} GST.xlsx`

export const gstSheetTitle = (month: number, calendarYear: number): string =>
  `${monthName(month)}'${calendarYear} GST`
