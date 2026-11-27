/**
 * Reading the firm's own spreadsheets, the ones that existed before the
 * website did.
 *
 * The backup file this site writes has a header row and an id on every line,
 * which makes loading it back easy. The two lists the office actually keeps
 * have neither. "Items Details" is a plain table with their own column
 * names and GST written as 0.18. "Companies Address" is not a table at all —
 * it is 141 addresses typed down a single column the way you would type them
 * onto an envelope, one blank row between each.
 *
 * Rather than a second importer with its own rules, both are translated into
 * the same rows the backup file would have had, and handed to the same
 * loader. So they inherit the behaviour that matters: a row already here is
 * left alone, the same file loaded twice changes nothing the second time,
 * and a file with ten new companies among a hundred old ones adds ten.
 */
import type { Row, Sheet } from './xlsx'

/* ------------------------------------------------------------ GST states */

/**
 * The first two digits of a GSTIN are the state that issued it, so a sheet
 * with no state column still knows which state every company is in — which
 * decides CGST/SGST against IGST, and is not a thing to guess at.
 */
const STATE_BY_CODE: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
}

/** Written on the line four different ways in their file alone. */
const GSTIN_LINE = /\bGST(?:IN)?\s*(?:NO\.?|NUMBER)?\s*[:.\-]?\s*([0-9A-Z]{15})\b/i

export const stateFromGstin = (gstin: string): string =>
  STATE_BY_CODE[gstin.trim().slice(0, 2)] ?? ''

/** A state named in the address itself, for the few with no GSTIN. */
const stateFromText = (text: string): string => {
  const names = Object.values(STATE_BY_CODE)
  const hit = names.find((n) => new RegExp(`\\b${n.replace(/ /g, '\\s+')}\\b`, 'i').test(text))
  return hit ?? ''
}

/* ----------------------------------------------------------- their items */

const CANONICAL_PRODUCTS = ['Id', 'Name', 'HSN/SAC', 'Unit', 'Per', 'Rate', 'GST %', 'Type', 'In use']

const cell = (row: string[], i: number) => (i < 0 ? '' : (row[i] ?? '').trim())

const columnOf = (header: string[], ...names: string[]): number => {
  for (const n of names) {
    const i = header.findIndex((h) => h.trim().toLowerCase() === n.toLowerCase())
    if (i >= 0) return i
  }
  return -1
}

/**
 * GST comes out of their sheet as 0.18 and out of ours as 18. Both mean the
 * same tax, and the difference is only which one Excel decided was a
 * percentage, so read either. A rate of 1 is taken as 1%, not as 100%: a 100%
 * GST does not exist and a 1% one does.
 */
export const gstPercent = (raw: string): number => {
  const n = Number(String(raw).replace(/[%\s]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return 0
  return n < 1 ? Math.round(n * 1000) / 10 : n
}

/**
 * Their "Items Details" sheet, if that is what this is.
 *
 * Recognised by its columns rather than by the tab's name, which is Sheet1.
 */
export const itemsSheetToRows = (rows: string[][]): string[][] | null => {
  const headerAt = rows.findIndex(
    (r) => columnOf(r, 'Product Name', 'Item Name') >= 0 && columnOf(r, 'HSN Code', 'HSN', 'HSN/SAC') >= 0,
  )
  if (headerAt < 0) return null

  const header = rows[headerAt]
  const c = {
    name: columnOf(header, 'Product Name', 'Item Name'),
    hsn: columnOf(header, 'HSN Code', 'HSN', 'HSN/SAC'),
    gst: columnOf(header, 'GST Rate', 'GST %', 'GST'),
    rate: columnOf(header, 'Rate', 'Price'),
    unit: columnOf(header, 'Unit', 'UQM'),
    per: columnOf(header, 'Per'),
  }

  const out: string[][] = [CANONICAL_PRODUCTS]
  for (const row of rows.slice(headerAt + 1)) {
    const name = cell(row, c.name)
    if (!name) continue
    const gst = gstPercent(cell(row, c.gst))
    out.push([
      '',
      name,
      cell(row, c.hsn),
      cell(row, c.unit),
      cell(row, c.per),
      cell(row, c.rate),
      gst ? String(gst) : '',
      'goods',
      'Yes',
    ])
  }
  return out.length > 1 ? out : null
}

/* ------------------------------------------------------- their companies */

export interface AddressBlock {
  serial: string
  name: string
  addressLines: string[]
  gstin: string
  state: string
}

/**
 * Splits the address column into one block per company.
 *
 * A blank row ends a block — that is how the file is typed and it is the only
 * separator there is. The serial in the first column is not relied on for
 * that, because it appears on the first line of a block and nowhere else, so
 * a block whose serial was never typed would otherwise swallow the next one.
 *
 * Within a block: the first line is the name, a line carrying a GSTIN is the
 * GSTIN wherever it sits, and everything else is the address in the order it
 * was typed. Trailing commas come off the name only — they belong in the
 * address, which is printed on the bill exactly as it is stored.
 */
export const parseAddressBlocks = (rows: string[][]): AddressBlock[] => {
  const blocks: AddressBlock[] = []
  let serial = ''
  let lines: string[] = []

  const flush = () => {
    if (lines.length) {
      const gstLine = lines.find((l) => GSTIN_LINE.test(l))
      const gstin = gstLine ? (GSTIN_LINE.exec(gstLine)?.[1] ?? '').toUpperCase() : ''
      const rest = lines.filter((l) => l !== gstLine)
      const name = (rest[0] ?? '').replace(/[,\s]+$/, '')
      const addressLines = rest.slice(1)
      if (name) {
        blocks.push({
          serial,
          name,
          addressLines,
          gstin,
          state: stateFromGstin(gstin) || stateFromText(addressLines.join(' ')),
        })
      }
    }
    serial = ''
    lines = []
  }

  for (const row of rows) {
    const cells = row.map((c) => (c ?? '').trim())
    if (!cells.some(Boolean)) {
      flush()
      continue
    }
    // the serial is a bare number in the first column; everything else is text
    cells.forEach((value, i) => {
      if (!value) return
      if (i === 0 && /^\d+$/.test(value)) {
        if (!serial) serial = value
        return
      }
      lines.push(value)
    })
  }
  flush()

  return blocks
}

const CANONICAL_COMPANIES = (lines: number) => [
  'Id',
  'Name',
  ...Array.from({ length: lines }, (_, i) => `Address ${i + 1}`),
  'GSTIN',
  'State',
  'Phone',
  'Email',
  'In use',
]

/**
 * Their "Companies Address" sheet, if that is what this is.
 *
 * Recognised by shape: no header anyone would call a header, and most of the
 * blocks carrying something that looks like a GSTIN. One stray GSTIN in a
 * column of notes is not enough.
 */
export const addressSheetToRows = (rows: string[][]): string[][] | null => {
  const blocks = parseAddressBlocks(rows)
  if (blocks.length < 2) return null

  const withGstin = blocks.filter((b) => b.gstin).length
  if (withGstin < blocks.length / 2) return null

  const lines = Math.max(1, ...blocks.map((b) => b.addressLines.length))
  const out: string[][] = [CANONICAL_COMPANIES(lines)]
  for (const b of blocks) {
    out.push([
      '',
      b.name,
      ...Array.from({ length: lines }, (_, i) => b.addressLines[i] ?? ''),
      b.gstin,
      b.state,
      '',
      '',
      'Yes',
    ])
  }
  return out
}

/* ------------------------------------------------------------------ both */

export type ForeignKind = 'products' | 'companies'

/**
 * What an unrecognised sheet turns out to be, if anything.
 *
 * Tried items-first: a table with named columns is a surer thing than a
 * column of free text, and the address reader is deliberately the looser of
 * the two.
 */
export const readForeignSheet = (
  rows: string[][],
): { kind: ForeignKind; rows: string[][] } | null => {
  const items = itemsSheetToRows(rows)
  if (items) return { kind: 'products', rows: items }

  const companies = addressSheetToRows(rows)
  if (companies) return { kind: 'companies', rows: companies }

  return null
}

/** Only used by the tests and the preview; the loader works on rows. */
export const asSheet = (name: string, rows: string[][]): Sheet => ({
  name,
  rows: rows.map((r): Row => r.map((v) => ({ v }))),
})
