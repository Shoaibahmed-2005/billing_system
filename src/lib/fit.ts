/**
 * Keeps a figure inside its column.
 *
 * The bill is a fixed grid: every column is a percentage of a 186mm sheet and
 * the type is 10.4pt, so the room inside any cell is known in advance. What is
 * not known in advance is how wide the text will be — "4,650.00" fits the
 * Amount column with room to spare, "2,88,000.00" does not, and a lakh-scale
 * bill would otherwise print its total across the rule.
 *
 * So each figure is measured before it is drawn and, if it would not fit, the
 * cell's type is shrunk just enough. Measuring happens on a canvas with the
 * same font stack the sheet uses, which matters because the stack resolves to
 * Arial on Windows and Roboto on Android, and those have different widths.
 *
 * The result is a plain percentage font-size baked into the element, so it
 * survives everything the bill is put through — the screen preview at any
 * zoom, the print stylesheet, and the html2canvas capture behind Save PDF.
 */

/** The sheet, as the stylesheet lays it out. Keep in step with invoice.css. */
const SHEET_MM = 186
const BODY_PT = 10.4
const MM_PER_PT = 25.4 / 72
const BODY_MM = BODY_PT * MM_PER_PT

/** Cell padding, both sides, plus a hair so ink never sits on the rule. */
const PAD_MM = 1.4 * 2 + 0.3

/**
 * Column widths, as percentages of the sheet. These are the same figures as
 * the `.c-*` rules in invoice.css, which were scanned off the printed sample.
 */
export const COL = {
  sl: 5.8,
  desc: 46.74,
  hsn: 10.05,
  qty: 9.43,
  rate: 10.16,
  per: 6.22,
  amt: 11.6,
} as const

/**
 * The HSN summary shares that grid and spans it differently, so its cells are
 * sums of the columns above.
 */
export const HSN_COL = {
  code: COL.sl + COL.desc,
  taxable: COL.hsn,
  rate: COL.qty,
  amount: COL.rate,
  rate2: COL.per,
  amount2: COL.amt,
  /** IGST merges the two tax pairs */
  wideRate: COL.qty + COL.rate,
  wideAmount: COL.per + COL.amt,
} as const

/**
 * Below this the figure would be too small to read, and something has gone
 * wrong anyway — 0.62 still carries a ten-digit total.
 */
const FLOOR = 0.62

type Weight = 400 | 700

let ctx: CanvasRenderingContext2D | null | undefined
const cache = new Map<string, number>()

/** Width of a string in em, measured in the sheet's own font. */
export const widthEm = (text: string, weight: Weight = 400): number => {
  const key = `${weight}|${text}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  if (ctx === undefined) {
    ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }

  let em: number
  if (ctx) {
    // 200px keeps the measurement well clear of hinting noise
    ctx.font = `${weight} 200px Arial, "Helvetica Neue", Helvetica, sans-serif`
    em = ctx.measureText(text).width / 200
  } else {
    // no canvas (tests, SSR) — Arial's own advance widths, close enough
    em = [...text].reduce((w, c) => w + (/[\d A-Za-z]/.test(c) ? 0.556 : 0.3), 0)
  }

  cache.set(key, em)
  return em
}

/**
 * How much to shrink `text` so it fits a column `widthPct` wide — 1 when it
 * already fits, which is the usual answer.
 */
export const fitScale = (text: string, widthPct: number, weight: Weight = 400): number => {
  if (!text) return 1
  const availMm = (widthPct / 100) * SHEET_MM - PAD_MM
  if (availMm <= 0) return 1
  const needMm = widthEm(text, weight) * BODY_MM
  if (needMm <= availMm) return 1
  return Math.max(FLOOR, availMm / needMm)
}

/**
 * One scale for a whole column: whatever its longest figure needs.
 *
 * Sizing each cell on its own would leave a column with several type sizes
 * down it — 11,82,000 small, 3,114 full size, right under each other — which
 * reads as a mistake even though every figure fits. A column shrinks together
 * or not at all. The paired tax columns are measured against the narrower of
 * the two for the same reason, so the same figure is never printed at two
 * sizes side by side.
 */
export const columnScale = (
  texts: ReadonlyArray<string>,
  widthPct: number,
  weight: Weight = 400,
): number => texts.reduce((s, t) => Math.min(s, fitScale(t, widthPct, weight)), 1)

/** A scale as a style, or nothing at all when the column fits as it is. */
export const scaleStyle = (scale: number): { fontSize: string } | undefined =>
  scale < 1 ? { fontSize: `${(scale * 100).toFixed(2)}%` } : undefined

/** One cell, measured and sized on its own. */
export const fitStyle = (
  text: string,
  widthPct: number,
  weight: Weight = 400,
): { fontSize: string } | undefined => scaleStyle(fitScale(text, widthPct, weight))
