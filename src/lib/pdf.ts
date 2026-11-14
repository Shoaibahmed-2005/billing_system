const A4 = { w: 210, h: 297 } // mm

/*
  The same margins the print stylesheet uses, so a saved PDF and a sheet off
  the printer are the same document. They used to differ: the PDF was laid out
  on a 194mm sheet against print's 186mm, which stretched every column by
  four percent and was enough to shift where the figures sat in them.
*/
const MARGIN = { x: 12, y: 11 }
const SHEET = { w: A4.w - MARGIN.x * 2, h: A4.h - MARGIN.y * 2 }

/** "Invoice-145-2026-2027-Primetec-Industries.pdf" */
export const invoiceFileName = (invoiceNo: string, buyerName: string): string => {
  const clean = (s: string) =>
    s
      .trim()
      .replace(/[\/\\]/g, '-')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 40)
  const parts = ['Invoice', clean(invoiceNo), clean(buyerName)].filter(Boolean)
  return `${parts.join('-')}.pdf`
}

/**
 * Renders the bill node to a single-page A4 PDF.
 *
 * The node handed in is the plain (non-editable) document kept off-screen, so
 * the PDF never picks up the input underlines from the bargaining view.
 */
export const invoiceToPdfBlob = async (node: HTMLElement): Promise<Blob> => {
  // Loaded on demand — together these are the heaviest thing in the app, and
  // most sessions never ask for a PDF.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(node, {
    scale: 2, // ~1470px across the bill — sharp enough for 8pt text, and quick
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  })

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  pdf.addImage(
    canvas.toDataURL('image/png', 1),
    'PNG',
    MARGIN.x,
    MARGIN.y,
    SHEET.w,
    Math.min((canvas.height / canvas.width) * SHEET.w, SHEET.h),
    undefined,
    'FAST',
  )

  return pdf.output('blob')
}

/**
 * Several bills into one PDF, a page each — what they send the accountant at
 * the end of a month. `onProgress` drives the counter in the UI, since a full
 * month of bills takes a while to rasterise.
 */
export const invoicesToPdfBlob = async (
  nodes: HTMLElement[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  for (let i = 0; i < nodes.length; i++) {
    const canvas = await html2canvas(nodes[i], {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })
    if (i > 0) pdf.addPage()
    pdf.addImage(
      canvas.toDataURL('image/png', 1),
      'PNG',
      MARGIN.x,
      MARGIN.y,
      SHEET.w,
      Math.min((canvas.height / canvas.width) * SHEET.w, SHEET.h),
      undefined,
      'FAST',
    )
    onProgress?.(i + 1, nodes.length)
    // let the progress counter paint between pages
    await new Promise((r) => setTimeout(r, 0))
  }

  return pdf.output('blob')
}

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Indian mobile/landline text -> wa.me digits. Returns '' when unusable. */
export const whatsappNumber = (raw?: string): string => {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return ''
}

export type ShareResult = 'shared' | 'downloaded-and-opened' | 'cancelled'

/**
 * Hands the PDF to the system share sheet when the browser supports sharing
 * files (Android, iOS, recent desktop Chrome on Windows). Everywhere else the
 * file is downloaded and WhatsApp Web is opened with the message ready, so the
 * only manual step left is attaching the file that just landed.
 */
export const sharePdf = async (
  blob: Blob,
  fileName: string,
  message: string,
  phone?: string,
): Promise<ShareResult> => {
  const file = new File([blob], fileName, { type: 'application/pdf' })
  const nav = navigator as Navigator & {
    canShare?: (d: ShareData) => boolean
    share?: (d: ShareData) => Promise<void>
  }

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], text: message })
      return 'shared'
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled'
      // fall through to the download route
    }
  }

  downloadBlob(blob, fileName)
  const to = whatsappNumber(phone)
  const url = to
    ? `https://wa.me/${to}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(url, '_blank', 'noopener')
  return 'downloaded-and-opened'
}
