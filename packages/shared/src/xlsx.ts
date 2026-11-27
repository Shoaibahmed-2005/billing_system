/**
 * Reading and writing .xlsx, with nothing installed.
 *
 * An .xlsx file is a zip of XML parts. Both halves of that are small enough
 * to do by hand, and doing it by hand is the point: the alternative is a
 * spreadsheet library of a few hundred kilobytes, downloaded onto a phone on
 * mobile data, for a feature the counter uses once a month. Everything here
 * is about two hundred lines and ships inside the bundle that is already
 * there.
 *
 * What it supports is what the backup and the GST sheet need: several
 * worksheets, text and numbers, formulas, bold headings, column widths, a
 * frozen heading row. No styling beyond that, no charts, no dates as real
 * date cells — the firm writes dates as "02.06.2026" text and the sheet they
 * already keep does the same.
 *
 * Text is written inline rather than through a shared-strings table. It makes
 * a slightly larger file and much simpler code, and Excel, LibreOffice and
 * Google Sheets all read it.
 */

/* ------------------------------------------------------------------- zip */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

const crc32 = (buf: Uint8Array): number => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const utf8 = (s: string) => new TextEncoder().encode(s)

interface Entry {
  name: string
  body: Uint8Array
}

/**
 * Writes a zip with every entry stored uncompressed.
 *
 * Deflate would need CompressionStream and all the async that comes with it,
 * for a saving that does not matter at this size — a year of bills is a few
 * hundred kilobytes either way, and a month sheet is a few tens.
 */
const zip = (entries: Entry[]): Blob => {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff]
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]

  for (const e of entries) {
    const name = utf8(e.name)
    const crc = crc32(e.body)
    const size = e.body.length

    const local = new Uint8Array([
      ...u32(0x04034b50),
      ...u16(20), // version needed
      ...u16(0x0800), // UTF-8 names
      ...u16(0), // stored
      ...u16(0), // time
      ...u16(0), // date
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(name.length),
      ...u16(0),
    ])

    chunks.push(local, name, e.body)

    central.push(
      new Uint8Array([
        ...u32(0x02014b50),
        ...u16(20), // version made by
        ...u16(20), // version needed
        ...u16(0x0800),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(crc),
        ...u32(size),
        ...u32(size),
        ...u16(name.length),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(offset),
      ]),
      name,
    )

    offset += local.length + name.length + size
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ])

  return new Blob([...chunks, ...central, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Pulls the entries back out of a zip, inflating the ones that need it. */
const unzip = async (data: ArrayBuffer): Promise<Map<string, Uint8Array>> => {
  const view = new DataView(data)
  const bytes = new Uint8Array(data)
  const out = new Map<string, Uint8Array>()

  // the end-of-central-directory record is last, after a comment of unknown
  // length, so it has to be hunted for backwards
  let eocd = -1
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip file')

  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)

  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break
    const method = view.getUint16(p + 10, true)
    const size = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const local = view.getUint32(p + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))

    // the local header repeats the name and extra fields, at its own lengths
    const lNameLen = view.getUint16(local + 26, true)
    const lExtraLen = view.getUint16(local + 28, true)
    const start = local + 30 + lNameLen + lExtraLen
    const raw = bytes.subarray(start, start + size)

    out.set(name, method === 0 ? raw : await inflateRaw(raw))
    p += 46 + nameLen + extraLen + commentLen
  }

  return out
}

const inflateRaw = async (raw: Uint8Array): Promise<Uint8Array> => {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser is too old to open .xlsx files. Try Chrome.')
  }
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/* ------------------------------------------------------------------- xml */

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // control characters are not legal in XML and Excel refuses the whole file
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

const unesc = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')

/** 1 -> "A", 27 -> "AA" */
export const colName = (n: number): string => {
  let s = ''
  while (n > 0) {
    s = String.fromCharCode(64 + ((n - 1) % 26) + 1) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/* ----------------------------------------------------------------- cells */

export interface Cell {
  /** text, or a number — numbers land in the sheet as numbers */
  v?: string | number | null
  /** a formula without the leading "=", e.g. "I2+K2+M2" */
  f?: string
  bold?: boolean
  /** the firm writes their sales ledger in red; this is that red */
  red?: boolean
  /** thin ruled box, as their own sheet has */
  box?: boolean
}

/**
 * Style numbers are a bitmask over the three flags, which keeps the styles
 * part fixed and tiny — eight formats covering every combination, written
 * once in buildWorkbook.
 */
const styleOf = (c: Cell): number => (c.bold ? 1 : 0) | (c.red ? 2 : 0) | (c.box ? 4 : 0)

export type Row = (Cell | string | number | null | undefined)[]

export interface Sheet {
  name: string
  rows: Row[]
  /** column widths in Excel's own units, left to right */
  widths?: number[]
  /** 1-based column numbers to roll up out of sight, as their own file does */
  hiddenColumns?: number[]
  /** keep the first row in view while scrolling, and give it filter arrows */
  freezeHeader?: boolean
}

const cellOf = (c: Row[number]): Cell =>
  c === null || c === undefined
    ? {}
    : typeof c === 'object'
      ? c
      : typeof c === 'number'
        ? { v: c }
        : { v: c }

const cellXml = (ref: string, c: Cell): string => {
  const s = styleOf(c)
  const style = s ? ` s="${s}"` : ''
  if (c.f) return `<c r="${ref}"${style}><f>${esc(c.f)}</f></c>`
  // an empty cell still has to be written when it is carrying a ruled box
  if (c.v === null || c.v === undefined || c.v === '') return s ? `<c r="${ref}"${style}/>` : ''
  if (typeof c.v === 'number') {
    if (!Number.isFinite(c.v)) return ''
    return `<c r="${ref}"${style}><v>${c.v}</v></c>`
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`
}

const sheetXml = (s: Sheet): string => {
  const width = Math.max(1, ...s.rows.map((r) => r.length))
  const hidden = new Set(s.hiddenColumns ?? [])
  const cols = s.widths?.length
    ? `<cols>${s.widths
        .map(
          (w, i) =>
            `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${
              hidden.has(i + 1) ? ' hidden="1"' : ''
            }/>`,
        )
        .join('')}</cols>`
    : ''

  const view = s.freezeHeader
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : ''

  const body = s.rows
    .map((row, i) => {
      const r = i + 1
      const cells = row
        .map((c, j) => cellXml(`${colName(j + 1)}${r}`, cellOf(c)))
        .join('')
      return cells ? `<row r="${r}">${cells}</row>` : `<row r="${r}"/>`
    })
    .join('')

  const filter =
    s.freezeHeader && s.rows.length > 1
      ? `<autoFilter ref="A1:${colName(width)}${s.rows.length}"/>`
      : ''

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${colName(width)}${Math.max(1, s.rows.length)}"/>${view}${cols}<sheetData>${body}</sheetData>${filter}</worksheet>`
}

/* -------------------------------------------------------------- workbook */

export const buildWorkbook = (sheets: Sheet[]): Blob => {
  const parts: Entry[] = []
  const add = (name: string, xml: string) => parts.push({ name, body: utf8(xml) })

  add(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('')}</Types>`,
  )

  add(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  )

  /*
    fullCalcOnLoad, because the formulas are written without a cached result.
    Excel works them out as it opens the file; without this it can show a
    column of blanks until something forces a recalculation.
  */
  add(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
      .map(
        (s, i) =>
          `<sheet name="${esc(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
      )
      .join('')}</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>`,
  )

  add(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  )

  /*
    Eight formats, indexed by the bold / red / box bitmask in styleOf: fonts
    0-3 are plain, bold, red, red bold; border 1 is the thin ruled box.
  */
  const thin = '<left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/>'
  const xfs = Array.from(
    { length: 8 },
    (_, i) =>
      `<xf numFmtId="0" fontId="${i & 3}" fillId="0" borderId="${i & 4 ? 1 : 0}" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>`,
  ).join('')

  add(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><color rgb="FFC00000"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFC00000"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border/><border>${thin}</border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8">${xfs}</cellXfs></styleSheet>`,
  )

  sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)))

  return zip(parts)
}

/* --------------------------------------------------------------- reading */

export interface ReadSheet {
  name: string
  /** every cell as the text it displays; short rows are padded out */
  rows: string[][]
}

/**
 * Reads a workbook into plain strings.
 *
 * Everything comes back as text on purpose. A sheet that has been round
 * tripped through Excel has numbers, text, dates and formula results mixed up
 * in ways that are not worth modelling — the importer knows which columns are
 * numbers and parses those itself.
 */
export const readWorkbook = async (file: Blob): Promise<ReadSheet[]> => {
  const files = await unzip(await file.arrayBuffer())

  const text = (name: string): string | null => {
    const b = files.get(name)
    return b ? new TextDecoder().decode(b) : null
  }

  const wb = text('xl/workbook.xml')
  if (!wb) throw new Error('That does not look like an Excel file.')

  // shared strings, if the writing program used them (Excel always does)
  const shared: string[] = []
  const ss = text('xl/sharedStrings.xml')
  if (ss) {
    for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      let t = ''
      for (const n of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) t += n[1]
      shared.push(unesc(t))
    }
  }

  const rels = text('xl/_rels/workbook.xml.rels') ?? ''
  const target = new Map<string, string>()
  for (const m of rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    target.set(m[1], m[2].replace(/^\/?(xl\/)?/, ''))
  }

  const out: ReadSheet[] = []
  for (const m of wb.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/g)) {
    const path = 'xl/' + (target.get(m[2]) ?? '')
    const xml = text(path)
    if (!xml) continue
    out.push({ name: unesc(m[1]), rows: parseSheet(xml, shared) })
  }
  return out
}

const parseSheet = (xml: string, shared: string[]): string[][] => {
  const rows: string[][] = []

  for (const rm of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const index = Number(rm[1]) - 1
    const row: string[] = []

    for (const cm of (rm[2] ?? '').matchAll(
      /<c\s+r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      let col = 0
      for (const ch of cm[1]) col = col * 26 + (ch.charCodeAt(0) - 64)

      const attrs = cm[2] ?? ''
      const body = cm[3] ?? ''
      const type = /t="([^"]+)"/.exec(attrs)?.[1]

      let value = ''
      if (type === 'inlineStr') {
        for (const t of body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) value += unesc(t[1])
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
        if (v !== undefined) {
          value = type === 's' ? (shared[Number(v)] ?? '') : unesc(v)
        }
      }

      while (row.length < col - 1) row.push('')
      row[col - 1] = value
    }

    while (rows.length < index) rows.push([])
    rows[index] = row
  }

  const width = Math.max(0, ...rows.map((r) => r.length))
  return rows.map((r) => {
    const padded = r.slice()
    while (padded.length < width) padded.push('')
    return padded.map((c) => c ?? '')
  })
}
