/**
 * The bill as a real PDF — lines and text, not a photograph of the screen.
 *
 * It used to be rasterised with html2canvas, and on the counter's phone the
 * result came out with every figure sitting on its rule. The cause is in how
 * that library works: it does not photograph the page, it clones the bill
 * into a frame of its own and lays it out a second time there. That second
 * layout is not the one you can see, and on Android it came out different —
 * so the bill was right on the screen, right on the laptop, and wrong in the
 * file the customer received.
 *
 * This takes the layout the browser has already done and transcribes it.
 * Every rule is drawn where the element's border actually is, and every piece
 * of text where the browser actually put it, read straight off the live
 * nodes. There is no second layout, so there is nothing to disagree with the
 * first — whatever the preview shows is what the PDF contains.
 *
 * Two things fall out of that. The text is text, so it can be selected and
 * searched, and a bill is some fifteen kilobytes instead of four hundred.
 */
import type { jsPDF } from 'jspdf'

/** A4, and the margins the print stylesheet uses. */
const A4 = { w: 210, h: 297 }
const MARGIN = { x: 12, y: 11 }
const SHEET = { w: A4.w - MARGIN.x * 2, h: A4.h - MARGIN.y * 2 }

const MM_PER_PT = 25.4 / 72

/** Everything on the bill is one family; Helvetica carries Arial's metrics. */
const FAMILY = 'helvetica'

type Ctx = {
  pdf: jsPDF
  /** mm per CSS pixel, taken from the node itself so any zoom cancels out */
  k: number
  /** the node's top-left in client coordinates */
  ox: number
  oy: number
  /** where the sheet is placed on the page */
  px: number
  py: number
}

const mmX = (c: Ctx, clientX: number) => c.px + (clientX - c.ox) * c.k
const mmY = (c: Ctx, clientY: number) => c.py + (clientY - c.oy) * c.k

const visible = (color: string) =>
  color !== 'transparent' && !/^rgba\([^)]*,\s*0\s*\)$/.test(color)

/** "rgb(0, 0, 0)" -> [0, 0, 0] */
const rgb = (color: string): [number, number, number] => {
  const m = color.match(/-?\d+(\.\d+)?/g)
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [0, 0, 0]
}

/* ------------------------------------------------------------------ rules */

/**
 * Draws an element's borders.
 *
 * The tables collapse their borders, so neighbouring cells each claim the
 * same rule and it gets drawn twice in the same place. That is harmless, and
 * far safer than trying to work out which side of a collapsed edge won.
 */
const drawBorders = (c: Ctx, el: Element, cs: CSSStyleDeclaration) => {
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return

  const sides = [
    ['Top', r.left, r.top, r.right, r.top],
    ['Right', r.right, r.top, r.right, r.bottom],
    ['Bottom', r.left, r.bottom, r.right, r.bottom],
    ['Left', r.left, r.top, r.left, r.bottom],
  ] as const

  for (const [side, x1, y1, x2, y2] of sides) {
    const w = parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`))
    const style = cs.getPropertyValue(`border-${side.toLowerCase()}-style`)
    const color = cs.getPropertyValue(`border-${side.toLowerCase()}-color`)
    if (!w || style === 'none' || style === 'hidden' || !visible(color)) continue

    c.pdf.setDrawColor(...rgb(color))
    c.pdf.setLineWidth(Math.max(w * c.k, 0.09))
    c.pdf.line(mmX(c, x1), mmY(c, y1), mmX(c, x2), mmY(c, y2))
  }
}

/* ------------------------------------------------------------------- text */

/**
 * One line of text, drawn where the browser put it.
 *
 * The rect handed in bounds the line box the browser laid out, so its left
 * edge is already the right place to start whatever the cell's alignment is —
 * centred and right-aligned cells give a rect that starts where the ink
 * starts. The baseline is taken as the middle of that line box, which jsPDF
 * resolves against the font's own metrics.
 */
const drawLine = (c: Ctx, text: string, rect: DOMRect, cs: CSSStyleDeclaration) => {
  const t = text.replace(/\s+/g, ' ')
  if (!t.trim()) return

  const sizePt = (parseFloat(cs.fontSize) * c.k) / MM_PER_PT
  const weight = Number(cs.fontWeight) >= 600 || cs.fontWeight === 'bold' ? 'bold' : 'normal'

  c.pdf.setFont(FAMILY, weight)
  c.pdf.setFontSize(sizePt)
  c.pdf.setTextColor(...rgb(cs.color))

  /*
    Helvetica is metric-compatible with Arial, but the phone laid the bill out
    in whatever it had — Roboto, usually — so a run can come out a shade wider
    here than the browser measured. Squeeze it back into the space the browser
    gave it rather than let it run past.
  */
  const roomMm = rect.width * c.k
  const haveMm = c.pdf.getTextWidth(t)
  const opts: { baseline: 'middle'; maxWidth?: number; charSpace?: number } = { baseline: 'middle' }
  if (haveMm > roomMm + 0.05 && t.length > 1) {
    opts.charSpace = (roomMm - haveMm) / (t.length - 1)
  }

  c.pdf.text(t, mmX(c, rect.left), mmY(c, rect.top + rect.height / 2), opts)
}

/**
 * Splits a text node into the lines the browser actually broke it into, and
 * draws each one. Wrapped descriptions and the declaration are the only
 * places this matters, but it has to be right there.
 */
const drawTextNode = (c: Ctx, node: Text, cs: CSSStyleDeclaration) => {
  const whole = node.data
  if (!whole.trim()) return

  const range = document.createRange()
  range.selectNodeContents(node)
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 || r.height > 0)
  if (rects.length === 0) return

  if (rects.length === 1) {
    drawLine(c, whole, rects[0], cs)
    return
  }

  // more than one line: find where the browser broke it
  const lines: { text: string; rect: DOMRect }[] = rects.map((r) => ({ text: '', rect: r }))
  const charRange = document.createRange()
  for (let i = 0; i < whole.length; i++) {
    charRange.setStart(node, i)
    charRange.setEnd(node, i + 1)
    const cr = charRange.getBoundingClientRect()
    if (!cr.height) continue
    // the line whose box this character sits in
    let best = 0
    let bestGap = Infinity
    for (let L = 0; L < lines.length; L++) {
      const gap = Math.abs(cr.top + cr.height / 2 - (lines[L].rect.top + lines[L].rect.height / 2))
      if (gap < bestGap) {
        bestGap = gap
        best = L
      }
    }
    lines[best].text += whole[i]
  }
  for (const l of lines) drawLine(c, l.text, l.rect, cs)
}

/* ------------------------------------------------------------------ walk */

const walk = (c: Ctx, el: Element) => {
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return

  drawBorders(c, el, cs)

  if (el instanceof HTMLImageElement && el.getAttribute('src')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      try {
        c.pdf.addImage(el, 'PNG', mmX(c, r.left), mmY(c, r.top), r.width * c.k, r.height * c.k)
      } catch {
        /* an image that will not load is not worth failing the bill over */
      }
    }
  }

  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) drawTextNode(c, child as Text, cs)
    else if (child.nodeType === Node.ELEMENT_NODE) walk(c, child as Element)
  }
}

/**
 * Draws one laid-out bill onto the current page of `pdf`.
 *
 * `node` must be on-screen or off-screen but rendered — a node that has never
 * been laid out has no geometry to copy.
 */
export const drawBill = (pdf: jsPDF, node: HTMLElement) => {
  const host = node.getBoundingClientRect()
  if (!host.width || !host.height) throw new Error('the bill has not been laid out')

  const k = SHEET.w / host.width
  const c: Ctx = { pdf, k, ox: host.left, oy: host.top, px: MARGIN.x, py: MARGIN.y }

  pdf.setLineCap('butt')
  pdf.setLineJoin('miter')
  walk(c, node)
}

/** Everything the two entry points share. */
const newDoc = async () => {
  const { jsPDF: Ctor } = await import('jspdf')
  return new Ctor({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
}

/** One bill, one A4 page. */
export const billToPdfBlob = async (node: HTMLElement): Promise<Blob> => {
  const pdf = await newDoc()
  drawBill(pdf, node)
  return pdf.output('blob')
}

/** A month of bills, a page each. */
export const billsToPdfBlob = async (
  nodes: HTMLElement[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> => {
  const pdf = await newDoc()
  for (let i = 0; i < nodes.length; i++) {
    if (i > 0) pdf.addPage()
    drawBill(pdf, nodes[i])
    onProgress?.(i + 1, nodes.length)
    // let the counter in the UI paint between pages
    await new Promise((r) => setTimeout(r, 0))
  }
  return pdf.output('blob')
}
