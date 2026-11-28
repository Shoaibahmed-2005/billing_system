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

/**
 * One line under TERMS & CONDITIONS — "Payment", "100% Advance".
 *
 * A list rather than a fixed set of fields, because which lines appear is
 * decided per quotation and not by the template. The counter adds the ones
 * this job needs and types the words; a quotation with no warranty simply
 * has no Warranty line, rather than an empty one.
 */
export interface QuoteTermRow {
  id: string
  label: string
  value: string
}

/**
 * The labels each template usually carries, in the order the samples print
 * them. They are what the + buttons offer and what a new quotation starts
 * with — a starting point, not a rule.
 */
export const TERM_LABELS: Record<QuoteTemplate, string[]> = {
  spares: ['Payment', 'Delivery', 'Freight', 'GST'],
  machine: ['Payment', 'Delivery', 'Freight', 'Validity', 'P & F', 'Warranty'],
}

/** Wording the firm reaches for, offered as a starting value. */
export const TERM_DEFAULTS: Record<string, string> = {
  Payment: '100% Advance',
  Delivery: 'One Week From the Date of Confirmation',
  Freight: 'Nil',
  GST: '18%',
  Validity: '45 days',
  'P & F': 'Nil',
  Warranty: '1 year from the date of supply made against manufacturing defects',
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
  terms: QuoteTermRow[]
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

let termSeq = 0
export const newTermRow = (label: string): QuoteTermRow => ({
  id: `t${++termSeq}${Math.random().toString(36).slice(2, 6)}`,
  label,
  value: TERM_DEFAULTS[label] ?? '',
})

export const defaultTerms = (template: QuoteTemplate): QuoteTermRow[] =>
  TERM_LABELS[template].map((l) =>
    l === 'Freight' && template === 'machine'
      ? { ...newTermRow(l), value: 'To Pay' }
      : newTermRow(l),
  )

export const emptyQuoteMeta = (template: QuoteTemplate, dated: string): QuoteMeta => ({
  template,
  slNo: '',
  dated,
  ref: '',
  refDate: '',
  subject: template === 'machine' ? 'Quotation For  Air Compressor & Air Dryer' : '',
  gstRate: 18,
  terms: defaultTerms(template),
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

/* ------------------------------------------------------------- paging --- */

/**
 * What one printed sheet measures, in millimetres, read off the rendered
 * document rather than assumed.
 *
 * Every line row is the same height, which is what makes a plan possible
 * without rendering each candidate page and measuring it again: the only
 * question is how many rows fit above the foot.
 */
export interface SheetMetrics {
  /** letterhead, consignee block and the table's heading row */
  headMm: number
  /** one line */
  rowMm: number
  /** the rows inside the table that are not lines: sub-total, GST, total */
  totalsMm: number
  /** terms and the sign-off, below the table */
  tailMm: number
}

/** A4 less the top and bottom margins the PDF is drawn with. */
export const PAGE_MM = 297 - 11 * 2

/**
 * How many lines go on each page.
 *
 * The foot — totals, terms, signature — travels with the last page and is
 * never split, because half a signature block across a page break is the
 * sort of thing that gets a quotation sent back.
 *
 * Which means the last page holds fewer lines than the others, and the ones
 * before it are filled. Every page carries at least one line: a final sheet
 * showing a letterhead, an empty table and a total is not a page anybody
 * would send, so lines are held back from the page before to keep it
 * company.
 *
 * Returns one number per page. A quotation that fits returns one number,
 * which is every line, and nothing about the existing output changes.
 */
export const planPages = (count: number, m: SheetMetrics, pageMm = PAGE_MM): number[] => {
  if (count <= 0) return [0]

  const room = Math.max(0, pageMm - m.headMm)
  const plain = Math.max(1, Math.floor(room / m.rowMm))
  const withFoot = Math.max(0, Math.floor((room - m.totalsMm - m.tailMm) / m.rowMm))

  if (count <= withFoot) return [count]

  const pages: number[] = []
  let left = count
  // the guard is for a measurement so broken that no page can hold anything
  for (let i = 0; left > withFoot && i < 60; i++) {
    // never take the last line: the final page must have something on it
    const take = Math.max(1, Math.min(plain, left - 1))
    pages.push(take)
    left -= take
  }
  if (left > 0) pages.push(left)
  return pages.length ? pages : [count]
}
