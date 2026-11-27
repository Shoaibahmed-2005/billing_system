import type { Company, InvoiceItem, TaxMode } from './types'
import { HOME_STATE } from './seller'
import { round2 } from './format'

export interface LineCalc {
  item: InvoiceItem
  /** qty x rate */
  taxable: number
  /** full GST on this line */
  tax: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export interface HsnRow {
  hsn: string
  gstRate: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
}

export interface InvoiceCalc {
  lines: LineCalc[]
  taxMode: TaxMode
  subTotal: number
  cgst: number
  sgst: number
  igst: number
  totalTax: number
  rawTotal: number
  roundOff: number
  grandTotal: number
  hsnRows: HsnRow[]
}

/** Buyer in the firm's own state -> CGST + SGST. Anywhere else -> IGST. */
export const taxModeForState = (state: string, homeState: string = HOME_STATE): TaxMode =>
  state.trim().toLowerCase() === homeState.trim().toLowerCase() ? 'intra' : 'inter'

export const taxModeForBuyer = (
  buyer: Company | null,
  homeState: string = HOME_STATE,
): TaxMode => (buyer ? taxModeForState(buyer.state, homeState) : 'intra')

export const lineAmount = (item: InvoiceItem): number => round2(item.qty * item.rate)

export const calcLine = (item: InvoiceItem, taxMode: TaxMode): LineCalc => {
  const taxable = lineAmount(item)
  const tax = round2((taxable * item.gstRate) / 100)
  const half = round2(tax / 2)
  const cgst = taxMode === 'intra' ? half : 0
  const sgst = taxMode === 'intra' ? round2(tax - half) : 0
  const igst = taxMode === 'inter' ? tax : 0
  return { item, taxable, tax, cgst, sgst, igst, total: round2(taxable + tax) }
}

export const calcInvoice = (items: InvoiceItem[], taxMode: TaxMode): InvoiceCalc => {
  const lines = items.map((i) => calcLine(i, taxMode))

  const subTotal = round2(lines.reduce((s, l) => s + l.taxable, 0))
  const cgst = round2(lines.reduce((s, l) => s + l.cgst, 0))
  const sgst = round2(lines.reduce((s, l) => s + l.sgst, 0))
  const igst = round2(lines.reduce((s, l) => s + l.igst, 0))
  const totalTax = round2(cgst + sgst + igst)
  const rawTotal = round2(subTotal + totalTax)
  const grandTotal = Math.round(rawTotal)
  const roundOff = round2(grandTotal - rawTotal)

  // Per-HSN breakdown — this is what gives them GST "separated" by product group:
  // all motors under 8501 land in one row, all bolts under 7318 in another.
  const map = new Map<string, HsnRow>()
  for (const l of lines) {
    const key = `${l.item.hsn}|${l.item.gstRate}`
    const row = map.get(key) ?? {
      hsn: l.item.hsn,
      gstRate: l.item.gstRate,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    }
    row.taxable = round2(row.taxable + l.taxable)
    row.cgst = round2(row.cgst + l.cgst)
    row.sgst = round2(row.sgst + l.sgst)
    row.igst = round2(row.igst + l.igst)
    map.set(key, row)
  }

  return {
    lines,
    taxMode,
    subTotal,
    cgst,
    sgst,
    igst,
    totalTax,
    rawTotal,
    roundOff,
    grandTotal,
    hsnRows: [...map.values()],
  }
}
