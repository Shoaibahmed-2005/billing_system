/**
 * Turns an uploaded signature into something that prints cleanly.
 *
 * A signature is almost always a photo or scan on white paper, and dropping
 * that straight onto the bill puts a white box over the ruled line. So the
 * background is cut out the same way the bundled one was: alpha comes from how
 * far each pixel is from white, which keeps the antialiased edges of the
 * stroke soft instead of leaving a grey fringe, and the ink is flattened to a
 * single colour so thin strokes survive being scaled down.
 */

const MAX_WIDTH = 700

export const MAX_SIGNATURE_BYTES = 6 * 1024 * 1024

export interface SignatureResult {
  dataUrl: string
  width: number
  height: number
}

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be opened as an image.'))
    }
    img.src = url
  })

export const prepareSignature = async (file: File): Promise<SignatureResult> => {
  if (!file.type.startsWith('image/')) throw new Error('Pick an image file.')
  if (file.size > MAX_SIGNATURE_BYTES) throw new Error('That image is too large (max 6 MB).')

  const img = await loadImage(file)
  const sw = img.naturalWidth
  const sh = img.naturalHeight
  if (!sw || !sh) throw new Error('That image looks empty.')

  const src = document.createElement('canvas')
  src.width = sw
  src.height = sh
  const sctx = src.getContext('2d', { willReadFrequently: true })
  if (!sctx) throw new Error('Could not read the image.')
  sctx.drawImage(img, 0, 0)

  const data = sctx.getImageData(0, 0, sw, sh)
  const px = data.data

  let minX = sw, minY = sh, maxX = -1, maxY = -1
  let inkR = 0, inkG = 0, inkB = 0, inkN = 0

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4
      const r = px[i], g = px[i + 1], b = px[i + 2]
      let a = 255 - Math.min(r, g, b)
      if (a < 40) a = 0 // paper, and the shadow of a phone photo
      px[i + 3] = a
      if (a > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        if (a > 170) { inkR += r; inkG += g; inkB += b; inkN++ }
      }
    }
  }
  if (maxX < 0) throw new Error('That image is blank — nothing but background.')

  const ink = inkN
    ? [Math.round(inkR / inkN), Math.round(inkG / inkN), Math.round(inkB / inkN)]
    : [20, 20, 120]
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] > 0) { px[i] = ink[0]; px[i + 1] = ink[1]; px[i + 2] = ink[2] }
  }
  sctx.putImageData(data, 0, 0)

  const pad = 4
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
  maxX = Math.min(sw - 1, maxX + pad); maxY = Math.min(sh - 1, maxY + pad)
  const cw = maxX - minX + 1
  const chh = maxY - minY + 1

  const scale = Math.min(1, MAX_WIDTH / cw)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(cw * scale))
  out.height = Math.max(1, Math.round(chh * scale))
  const octx = out.getContext('2d')
  if (!octx) throw new Error('Could not build the image.')
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(src, minX, minY, cw, chh, 0, 0, out.width, out.height)

  return { dataUrl: out.toDataURL('image/png'), width: out.width, height: out.height }
}
