import type { Invoice } from './types'

/**
 * Invoice numbering.
 *
 * The number stays hand-typed — they run a second, handwritten series and need
 * to keep the two in step. All this does is suggest the next one and show what
 * the last one was, so a mistyped number is obvious before it is saved.
 *
 * Numbers look like "146/2026-2027": a sequence, then the financial year.
 */

const PATTERN = /^\s*(\d+)\s*\/\s*(\d{4})\s*-\s*(\d{4})\s*$/

export interface ParsedNo {
  seq: number
  fy: string
}

export const parseInvoiceNo = (no: string): ParsedNo | null => {
  const m = PATTERN.exec(no)
  if (!m) return null
  return { seq: Number(m[1]), fy: `${m[2]}-${m[3]}` }
}

/** The Indian financial year a date falls in: April to March. */
export const financialYear = (d: Date = new Date()): string => {
  const y = d.getFullYear()
  return d.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

/** The most recent bill in this financial year, by sequence number. */
export const lastInvoiceOfYear = (invoices: Invoice[], fy = financialYear()): Invoice | null => {
  let best: Invoice | null = null
  let bestSeq = -1
  for (const inv of invoices) {
    const p = parseInvoiceNo(inv.meta.invoiceNo)
    if (!p || p.fy !== fy) continue
    if (p.seq > bestSeq) {
      bestSeq = p.seq
      best = inv
    }
  }
  return best
}

/**
 * The number to pre-fill. Carries on from the highest sequence already used
 * this financial year; starts the year at 1 when there is nothing to follow.
 */
export const nextInvoiceNo = (invoices: Invoice[], fy = financialYear()): string => {
  const last = lastInvoiceOfYear(invoices, fy)
  const seq = last ? (parseInvoiceNo(last.meta.invoiceNo)?.seq ?? 0) + 1 : 1
  return `${seq}/${fy}`
}

/** True when this number is already on another saved bill. */
export const isDuplicateNo = (
  invoices: Invoice[],
  no: string,
  exceptId?: string,
): boolean => {
  const key = no.trim().toLowerCase()
  if (!key) return false
  return invoices.some((i) => i.id !== exceptId && i.meta.invoiceNo.trim().toLowerCase() === key)
}

/* ------------------------------------------------------- date on the bill */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "02.09.2026" -> {year: 2026, month: 8}; falls back to when it was saved. */
export const billDate = (inv: Invoice): Date => {
  const m = /^\s*(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\s*$/.exec(inv.meta.dated)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  const d = new Date(inv.createdAt)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export const monthName = (monthIndex: number): string => MONTHS[monthIndex] ?? ''

/**
 * Orders bills the way the client reads a month: first bill of the month
 * first, last bill last. Sequence number wins when both are in the same
 * series, since that is the true order they were written in.
 */
export const byBillOrder = (a: Invoice, b: Invoice): number => {
  const pa = parseInvoiceNo(a.meta.invoiceNo)
  const pb = parseInvoiceNo(b.meta.invoiceNo)
  if (pa && pb && pa.fy === pb.fy) return pa.seq - pb.seq
  const da = billDate(a).getTime()
  const db = billDate(b).getTime()
  if (da !== db) return da - db
  return a.createdAt.localeCompare(b.createdAt)
}
