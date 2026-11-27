import { billToPdfBlob, billsToPdfBlob } from './billPdf'

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
 *
 * The drawing itself is in billPdf.ts, which transcribes the layout the
 * browser has already done rather than re-rendering the bill. That is the
 * whole point: the previous version rasterised it with html2canvas, which
 * lays the bill out a second time in a frame of its own, and on Android that
 * second layout disagreed with the first — the bill looked right on the
 * phone and reached the customer with its figures across the rules.
 */
export const invoiceToPdfBlob = (node: HTMLElement): Promise<Blob> => billToPdfBlob(node)

/**
 * Several bills into one PDF, a page each — what they send the accountant at
 * the end of a month. `onProgress` drives the counter in the UI.
 */
export const invoicesToPdfBlob = (
  nodes: HTMLElement[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> => billsToPdfBlob(nodes, onProgress)

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
