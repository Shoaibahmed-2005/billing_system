/**
 * The monthly backup: the catalogue and the ledger as a spreadsheet they can
 * keep anywhere, and read back in if the database is ever lost.
 *
 * Supabase charges for its own backups, so this is the counter's version of
 * one. It has to be a spreadsheet rather than an export file because the
 * point is that a person can open it, read it and see that their data is
 * really in there — a file nobody can read is not reassuring enough to be
 * worth keeping.
 *
 * Two rules make loading it back safe:
 *
 *   Everything carries its id. Load the same file twice and the second time
 *   changes nothing, because every row is recognised as one already present.
 *   A product renamed since the backup still matches on its id, so it comes
 *   back as itself rather than as a second copy.
 *
 *   Nothing already here is ever touched. Only rows that have gone missing
 *   are put back. That means an old backup loaded by mistake cannot undo a
 *   term of price changes — the worst it can do is restore something that was
 *   deleted on purpose, which is visible and reversible.
 *
 * The cost of the second rule is that bulk-editing rates in Excel and loading
 * them back does nothing. That is deliberate; ask before changing it.
 */
import type { Company, Invoice, InvoiceItem, Product } from './types'
import { buildWorkbook, readWorkbook, type Row, type Sheet } from './xlsx'
import {
  listCompanies,
  listInvoices,
  listProducts,
  newId,
  saveCompany,
  saveInvoice,
  saveProduct,
} from './store'
import { calcInvoice, lineAmount } from './gst'
import { byBillOrder } from './invoiceNo'
import { round2 } from './format'

export const PRODUCTS_SHEET = 'Products'
export const COMPANIES_SHEET = 'Companies'
export const BILLS_SHEET = 'Bills'

const yesNo = (b: boolean) => (b ? 'Yes' : 'No')
const isNo = (s: string) => /^\s*(no|false|0|inactive)\s*$/i.test(s)

const num = (s: string): number => {
  const n = Number(String(s).replace(/[, ₹]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const head = (cells: string[]): Row => cells.map((v) => ({ v, bold: true }))

/* --------------------------------------------------------------- writing */

const PRODUCT_COLUMNS = [
  'Id',
  'Name',
  'HSN/SAC',
  'Unit',
  'Per',
  'Rate',
  'GST %',
  'Type',
  'In use',
]

export const productsSheet = (products: Product[]): Sheet => ({
  name: PRODUCTS_SHEET,
  freezeHeader: true,
  widths: [18, 46, 12, 10, 10, 12, 9, 11, 9],
  rows: [
    head(PRODUCT_COLUMNS),
    ...products.map((p) => [
      p.id,
      p.name,
      p.hsn,
      p.unit,
      p.per,
      p.rate,
      p.gstRate,
      p.kind === 'service' ? 'Service' : 'Goods',
      yesNo(p.active),
    ]),
  ],
})

/**
 * Addresses print line by line under Consignee, so they are kept line by
 * line here too. Flattening them to one cell would quietly reflow every
 * address on every bill the next time one was restored.
 */
const addressColumns = (companies: Company[]) =>
  Math.max(3, ...companies.map((c) => c.addressLines.length))

export const companiesSheet = (companies: Company[]): Sheet => {
  const lines = addressColumns(companies)
  const columns = [
    'Id',
    'Name',
    ...Array.from({ length: lines }, (_, i) => `Address ${i + 1}`),
    'GSTIN',
    'State',
    'Phone',
    'Email',
    'In use',
  ]

  return {
    name: COMPANIES_SHEET,
    freezeHeader: true,
    widths: [18, 40, ...Array.from({ length: lines }, () => 32), 20, 18, 16, 28, 9],
    rows: [
      head(columns),
      ...companies.map((c) => [
        c.id,
        c.name,
        ...Array.from({ length: lines }, (_, i) => c.addressLines[i] ?? ''),
        c.gstin,
        c.state,
        c.phone ?? '',
        c.email ?? '',
        yesNo(c.active),
      ]),
    ],
  }
}

const BILL_COLUMNS = [
  'Bill Id',
  'Invoice No',
  'Date',
  'Buyer',
  'Buyer GSTIN',
  'Buyer State',
  'Buyer Address',
  'Tax',
  'Mode/Terms of Payment',
  'Customer PO No',
  'Despatch Through',
  'Destination',
  'Terms of Delivery',
  'Signature',
  'Description',
  'HSN/SAC',
  'Qty',
  'Unit',
  'Rate',
  'Per',
  'GST %',
  'Type',
  'Amount',
]

/**
 * One row per line of every bill, with the bill's own details repeated down
 * its block. Repeating them is what makes the sheet readable as a ledger and
 * what lets a single row be matched back to its bill on the way in.
 */
export const billsSheet = (invoices: Invoice[]): Sheet => {
  const rows: Row[] = [head(BILL_COLUMNS)]

  for (const inv of [...invoices].sort(byBillOrder)) {
    for (const item of inv.items) {
      rows.push([
        inv.id,
        inv.meta.invoiceNo,
        inv.meta.dated,
        inv.buyer.name,
        inv.buyer.gstin,
        inv.buyer.state,
        inv.buyer.addressLines.join(' / '),
        inv.taxMode === 'inter' ? 'IGST' : 'CGST+SGST',
        inv.meta.modeTerms,
        inv.meta.customerPoNo,
        inv.meta.despatchThrough,
        inv.meta.destination,
        inv.meta.termsOfDelivery,
        yesNo(inv.showSignature !== false),
        item.description,
        item.hsn,
        item.qty,
        item.unit,
        item.rate,
        item.per,
        item.gstRate,
        item.kind === 'service' ? 'Service' : 'Goods',
        lineAmount(item),
      ])
    }
  }

  return {
    name: BILLS_SHEET,
    freezeHeader: true,
    widths: [18, 18, 13, 34, 20, 16, 44, 13, 24, 18, 20, 20, 20, 10, 44, 12, 8, 9, 12, 9, 8, 10, 13],
    rows,
  }
}

export const productsWorkbook = (products: Product[]): Blob =>
  buildWorkbook([productsSheet(products)])

export const companiesWorkbook = (companies: Company[]): Blob =>
  buildWorkbook([companiesSheet(companies)])

export const billsWorkbook = (invoices: Invoice[]): Blob =>
  buildWorkbook([billsSheet(invoices)])

/** "Naveen-Airtech-products-24.11.2026.xlsx" */
export const backupFileName = (what: string): string => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `Naveen-Airtech-${what}-${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}.xlsx`
}

/* --------------------------------------------------------------- reading */

export interface RestoreCount {
  /** rows that were missing and have been put back */
  added: number
  /** rows that are already in the system, left exactly as they were */
  alreadyThere: number
  /** rows that could not be read — no name, usually a stray line */
  skipped: number
}

export interface RestoreReport {
  products: RestoreCount
  companies: RestoreCount
  bills: RestoreCount
  /** sheets in the file that this app does not know what to do with */
  ignored: string[]
}

const empty = (): RestoreCount => ({ added: 0, alreadyThere: 0, skipped: 0 })

export const nothingRestored = (r: RestoreReport): boolean =>
  r.products.added + r.companies.added + r.bills.added === 0

/** Reads a heading row into a name -> column index map, case-insensitively. */
const headerMap = (row: string[]): Map<string, number> => {
  const m = new Map<string, number>()
  row.forEach((cell, i) => {
    const key = cell.trim().toLowerCase()
    if (key && !m.has(key)) m.set(key, i)
  })
  return m
}

const pick = (row: string[], map: Map<string, number>, ...names: string[]): string => {
  for (const n of names) {
    const i = map.get(n.toLowerCase())
    if (i !== undefined) return (row[i] ?? '').trim()
  }
  return ''
}

const key = (s: string) => s.trim().toLowerCase()

/**
 * Loads a backup file, putting back only what has gone missing.
 *
 * It takes whichever of the three sheets the file happens to contain, so the
 * three separate downloads and a combined one all work the same way.
 */
export const restoreFromWorkbook = async (file: Blob): Promise<RestoreReport> => {
  const sheets = await readWorkbook(file)
  const report: RestoreReport = {
    products: empty(),
    companies: empty(),
    bills: empty(),
    ignored: [],
  }

  for (const sheet of sheets) {
    const name = key(sheet.name)
    if (name === key(PRODUCTS_SHEET)) await restoreProducts(sheet.rows, report.products)
    else if (name === key(COMPANIES_SHEET)) await restoreCompanies(sheet.rows, report.companies)
    else if (name === key(BILLS_SHEET)) await restoreBills(sheet.rows, report.bills)
    else if (sheet.rows.some((r) => r.some((c) => c.trim()))) report.ignored.push(sheet.name)
  }

  if (!sheets.length) throw new Error('That file has no sheets in it.')
  return report
}

const restoreProducts = async (rows: string[][], count: RestoreCount) => {
  if (rows.length < 2) return
  const map = headerMap(rows[0])

  const existing = await listProducts()
  const byId = new Map(existing.map((p) => [p.id, p]))
  const byName = new Map(existing.map((p) => [key(p.name), p]))
  const taken = new Set(existing.map((p) => p.id))

  for (const row of rows.slice(1)) {
    const name = pick(row, map, 'Name')
    if (!name) {
      if (row.some((c) => c.trim())) count.skipped++
      continue
    }

    const id = pick(row, map, 'Id')
    if ((id && byId.has(id)) || byName.has(key(name))) {
      count.alreadyThere++
      continue
    }

    const product: Product = {
      id: id && !taken.has(id) ? id : newId('p'),
      name,
      hsn: pick(row, map, 'HSN/SAC', 'HSN', 'HSN Code'),
      unit: pick(row, map, 'Unit', 'UQM'),
      per: pick(row, map, 'Per'),
      rate: num(pick(row, map, 'Rate')),
      gstRate: num(pick(row, map, 'GST %', 'GST')) || 18,
      kind: /service/i.test(pick(row, map, 'Type', 'Kind')) ? 'service' : 'goods',
      active: !isNo(pick(row, map, 'In use', 'Active')),
    }

    await saveProduct(product)
    taken.add(product.id)
    byId.set(product.id, product)
    byName.set(key(product.name), product)
    count.added++
  }
}

const restoreCompanies = async (rows: string[][], count: RestoreCount) => {
  if (rows.length < 2) return
  const map = headerMap(rows[0])

  // Address 1, Address 2, ... however many the file happens to carry
  const addressCols = rows[0]
    .map((c, i) => ({ c: c.trim(), i }))
    .filter(({ c }) => /^address\s*\d*$/i.test(c))
    .map(({ i }) => i)

  const existing = await listCompanies()
  const byId = new Map(existing.map((c) => [c.id, c]))
  const byName = new Map(existing.map((c) => [key(c.name), c]))
  const taken = new Set(existing.map((c) => c.id))

  for (const row of rows.slice(1)) {
    const name = pick(row, map, 'Name')
    if (!name) {
      if (row.some((c) => c.trim())) count.skipped++
      continue
    }

    const id = pick(row, map, 'Id')
    if ((id && byId.has(id)) || byName.has(key(name))) {
      count.alreadyThere++
      continue
    }

    const company: Company = {
      id: id && !taken.has(id) ? id : newId('c'),
      name,
      addressLines: addressCols.map((i) => (row[i] ?? '').trim()).filter(Boolean),
      gstin: pick(row, map, 'GSTIN', 'GST No', 'GST'),
      state: pick(row, map, 'State') || 'Tamil Nadu',
      phone: pick(row, map, 'Phone') || undefined,
      email: pick(row, map, 'Email') || undefined,
      active: !isNo(pick(row, map, 'In use', 'Active')),
    }

    await saveCompany(company)
    taken.add(company.id)
    byId.set(company.id, company)
    byName.set(key(company.name), company)
    count.added++
  }
}

/**
 * Bills arrive one line at a time, so the rows have to be gathered back into
 * bills first. A block is held together by its bill id, or by its invoice
 * number if the id column was lost.
 */
const restoreBills = async (rows: string[][], count: RestoreCount) => {
  if (rows.length < 2) return
  const map = headerMap(rows[0])

  const existing = await listInvoices()
  const byId = new Map(existing.map((i) => [i.id, i]))
  const byNo = new Map(existing.map((i) => [key(i.meta.invoiceNo), i]))
  const taken = new Set(existing.map((i) => i.id))

  interface Block {
    id: string
    no: string
    row: string[]
    items: InvoiceItem[]
  }

  const blocks: Block[] = []
  let current: Block | null = null

  for (const row of rows.slice(1)) {
    const id = pick(row, map, 'Bill Id', 'Id')
    const no = pick(row, map, 'Invoice No')
    const description = pick(row, map, 'Description')

    if (!description) {
      if (row.some((c) => c.trim())) count.skipped++
      continue
    }

    const sameBill = current && (id ? current.id === id : current.no === no)
    if (!sameBill) {
      current = { id, no, row, items: [] }
      blocks.push(current)
    }

    const qty = num(pick(row, map, 'Qty', 'Quantity'))
    const rate = num(pick(row, map, 'Rate'))
    current!.items.push({
      lineId: newId('l'),
      productId: null,
      description,
      hsn: pick(row, map, 'HSN/SAC', 'HSN', 'HSN Code'),
      qty,
      unit: pick(row, map, 'Unit', 'UQM'),
      rate,
      per: pick(row, map, 'Per'),
      gstRate: num(pick(row, map, 'GST %', 'GST')) || 18,
      kind: /service/i.test(pick(row, map, 'Type', 'Kind')) ? 'service' : 'goods',
    })
  }

  for (const block of blocks) {
    if ((block.id && byId.has(block.id)) || (block.no && byNo.has(key(block.no)))) {
      count.alreadyThere++
      continue
    }
    if (!block.no) {
      count.skipped++
      continue
    }

    const row = block.row
    const inter = /igst/i.test(pick(row, map, 'Tax'))
    const buyer: Company = {
      id: newId('c'),
      name: pick(row, map, 'Buyer'),
      addressLines: pick(row, map, 'Buyer Address')
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean),
      gstin: pick(row, map, 'Buyer GSTIN'),
      state: pick(row, map, 'Buyer State') || 'Tamil Nadu',
      active: true,
    }

    const invoice: Invoice = {
      id: block.id && !taken.has(block.id) ? block.id : newId('i'),
      meta: {
        invoiceNo: block.no,
        dated: pick(row, map, 'Date'),
        modeTerms: pick(row, map, 'Mode/Terms of Payment', 'Mode/Terms'),
        customerPoNo: pick(row, map, 'Customer PO No'),
        despatchThrough: pick(row, map, 'Despatch Through'),
        destination: pick(row, map, 'Destination'),
        termsOfDelivery: pick(row, map, 'Terms of Delivery'),
      },
      buyer,
      items: block.items,
      taxMode: inter ? 'inter' : 'intra',
      taxModeAuto: false,
      showSignature: !isNo(pick(row, map, 'Signature')),
      createdAt: new Date().toISOString(),
      grandTotal: 0,
    }
    invoice.grandTotal = round2(calcInvoice(invoice.items, invoice.taxMode).grandTotal)

    await saveInvoice(invoice)
    taken.add(invoice.id)
    byId.set(invoice.id, invoice)
    byNo.set(key(invoice.meta.invoiceNo), invoice)
    count.added++
  }
}
