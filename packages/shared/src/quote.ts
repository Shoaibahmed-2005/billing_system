import type { Company, ItemKind } from './types'
import { round2 } from './format'

/**
 * Quotations.
 *
 * The firm sends two quite different sheets and wants both kept, so the
 * template is part of the document rather than a setting:
 *
 *   spares   — a priced quotation that adds up. Serial number, Ref, a
 *              Consignee block, and Sub-total / GST / Total at the foot.
 *   machine  — a quotation for a compressor or a dryer. No serial, no total
 *              at all: it prints "GST 18% Extra" and leaves the arithmetic
 *              to the buyer. Carries its own terms (Validity, P & F,
 *              Warranty) and a subject line.
 *
 * Both were measured off the firm's own PDFs — column positions, which rules
 * are drawn and which are not, down to "Particulars" against "DESCRIPTION".
 * Change them against a fresh measurement, not by eye.
 */
export type QuoteTemplate = 'spares' | 'machine'

export interface QuoteItem {
  lineId: string
  productId: string | null
  description: string
  hsn: string
  qty: number
  /** printed whole, as the sample does: "1 No", "2 Nos", "1 Set" */
  unit: string
  rate: number
  kind: ItemKind
}

/** The lines under TERMS & CONDITIONS. Which ones print depends on the template. */
export interface QuoteTerms {
  payment: string
  delivery: string
  freight: string
  /** spares only */
  gst: string
  /** machine only */
  validity: string
  pf: string
  warranty: string
}

export interface QuoteMeta {
  template: QuoteTemplate
  /** "67" — spares only; the machine sheet carries no serial */
  slNo: string
  dated: string
  /** spares only */
  ref: string
  refDate: string
  /** machine only: "Quotation For Air Compressor & Air Dryer" */
  subject: string
  /** printed as "GST 18%" or "GST 18% Extra" depending on the template */
  gstRate: number
  terms: QuoteTerms
  signatory: string
  signatoryTitle: string
  signatoryCell: string
}

export interface Quotation {
  id: string
  meta: QuoteMeta
  buyer: Company
  items: QuoteItem[]
  createdAt: string
  /** cached for the list — the spares total, or the bare sum on a machine sheet */
  total: number
}

export const quoteLineValue = (item: QuoteItem): number => round2(item.qty * item.rate)

export interface QuoteCalc {
  lines: { item: QuoteItem; value: number }[]
  subTotal: number
  gst: number
  total: number
}

export const calcQuote = (items: QuoteItem[], gstRate: number): QuoteCalc => {
  const lines = items.map((item) => ({ item, value: quoteLineValue(item) }))
  const subTotal = round2(lines.reduce((s, l) => s + l.value, 0))
  const gst = round2((subTotal * gstRate) / 100)
  return { lines, subTotal, gst, total: round2(subTotal + gst) }
}

export const DEFAULT_TERMS: QuoteTerms = {
  payment: '100% Advance',
  delivery: 'One Week From the Date of Confirmation',
  freight: 'Nil',
  gst: '18%',
  validity: '45 days',
  pf: 'Nil',
  warranty: '1 year from the date of supply made against manufacturing defects',
}

export const emptyQuoteMeta = (template: QuoteTemplate, dated: string): QuoteMeta => ({
  template,
  slNo: '',
  dated,
  ref: '',
  refDate: '',
  subject: template === 'machine' ? 'Quotation For  Air Compressor & Air Dryer' : '',
  gstRate: 18,
  terms: { ...DEFAULT_TERMS, freight: template === 'machine' ? 'To Pay' : 'Nil' },
  signatory: template === 'machine' ? 'Kumar,' : 'C. Kumar,',
  signatoryTitle: 'Executive - Customer Support.',
  signatoryCell: 'Cell : 99943 44413.',
})

/** The next serial for the spares series, which is a plain running number. */
export const nextQuoteNo = (quotations: Quotation[]): string => {
  let best = 0
  for (const q of quotations) {
    const n = Number(String(q.meta.slNo).trim())
    if (Number.isFinite(n) && n > best) best = n
  }
  return String(best + 1)
}
