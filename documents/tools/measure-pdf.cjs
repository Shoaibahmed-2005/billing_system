/*
  Pull the text runs out of a PDF with the font each one is set in.

  Enough of a PDF reader to answer one question: which words on the firm's
  own quotation are bold, and where do they sit. Streams are inflated, the
  font resource names (/F1, /F2) are matched to their BaseFont, and every
  show-text operator is reported with the current font, size and position.
*/
const fs = require('fs')
const zlib = require('zlib')

const buf = fs.readFileSync(process.argv[2])
const raw = buf.toString('latin1')

// --- objects -------------------------------------------------------------
const objects = new Map()
for (const m of raw.matchAll(/(\d+)\s+(\d+)\s+obj\b([\s\S]*?)endobj/g)) {
  objects.set(Number(m[1]), m[3])
}

const streamOf = (body) => {
  const i = body.indexOf('stream')
  if (i < 0) return null
  let s = i + 'stream'.length
  if (raw[s] === '\r') s++
  if (body[s] === '\n') s++
  const start = body.indexOf('stream', 0) + 'stream'.length
  let from = start
  while (body[from] === '\r' || body[from] === '\n') from++
  const end = body.indexOf('endstream', from)
  const data = Buffer.from(body.slice(from, end), 'latin1')
  if (/\/FlateDecode/.test(body.slice(0, i))) {
    try {
      return zlib.inflateSync(data)
    } catch {
      try {
        return zlib.inflateRawSync(data)
      } catch {
        return null
      }
    }
  }
  return data
}

// --- fonts ---------------------------------------------------------------
const baseFont = (num) => {
  const body = objects.get(num)
  if (!body) return '?'
  const m = /\/BaseFont\s*\/([^\s/>\]]+)/.exec(body)
  return m ? m[1] : '?'
}

// --- pages ---------------------------------------------------------------
const pages = []
for (const [num, body] of objects) {
  if (!/\/Type\s*\/Page\b/.test(body)) continue
  const fonts = new Map()
  const fontBlock = /\/Font\s*<<([\s\S]*?)>>/.exec(body)
  if (fontBlock) {
    for (const f of fontBlock[1].matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g)) {
      fonts.set(f[1], baseFont(Number(f[2])))
    }
  } else {
    // resources may be an indirect object
    const resRef = /\/Resources\s+(\d+)\s+\d+\s+R/.exec(body)
    if (resRef) {
      const res = objects.get(Number(resRef[1])) || ''
      const fb = /\/Font\s*<<([\s\S]*?)>>/.exec(res)
      if (fb) for (const f of fb[1].matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g)) fonts.set(f[1], baseFont(Number(f[2])))
    }
  }
  const cRef = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(body)
  const content = cRef ? streamOf(objects.get(Number(cRef[1])) || '') : null
  pages.push({ num, fonts, content })
}

// --- content -------------------------------------------------------------
const unescape = (s) =>
  s.replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[c] ?? c))

pages.forEach((p, idx) => {
  if (!p.content) return console.log(`page ${idx + 1}: no readable content`)
  const s = p.content.toString('latin1')
  let font = '?'
  let size = 0
  let x = 0
  let y = 0
  const runs = []
  const rects = []
  for (const m of s.matchAll(
    /\/(\w+)\s+([\d.]+)\s+Tf|([-\d.]+)\s+([-\d.]+)\s+Td|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+(?:Tm|cm)|\(((?:[^()\\]|\\.)*)\)\s*Tj|\[((?:[^\][]|\\.)*)\]\s*TJ|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+re/g,
  )) {
    if (m[1]) {
      font = p.fonts.get(m[1]) || m[1]
      size = Number(m[2])
    } else if (m[3] !== undefined) {
      x += Number(m[3])
      y += Number(m[4])
    } else if (m[5] !== undefined) {
      x = Number(m[9])
      y = Number(m[10])
    } else if (m[11] !== undefined) {
      runs.push({ t: unescape(m[11]), font, size, x: Math.round(x), y: Math.round(y) })
    } else if (m[12] !== undefined) {
      const t = [...m[12].matchAll(/\((?:[^()\\]|\\.)*\)/g)].map((z) => unescape(z[0].slice(1, -1))).join('')
      runs.push({ t, font, size, x: Math.round(x), y: Math.round(y) })
    } else if (m[13] !== undefined) {
      rects.push([m[13], m[14], m[15], m[16]].map(Number).map((n) => Math.round(n)))
    }
  }
  console.log(`\n===== page ${idx + 1}  (${runs.length} text runs, ${rects.length} rectangles)`)
  console.log('fonts:', [...new Set([...p.fonts.values()])].join(', '))
  if (process.argv[3] === 'rects') {
    rects
      .slice()
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .forEach(([x, y, w, h]) =>
        console.log(`  rect x=${String(x).padStart(4)} y=${String(y).padStart(4)} w=${String(w).padStart(4)} h=${String(h).padStart(4)}  ${h === 0 ? 'horizontal rule' : w === 0 ? 'vertical rule' : 'box'}`),
      )
    return
  }
  const want = process.argv[3]
  for (const r of runs) {
    if (want && !r.t.toLowerCase().includes(want.toLowerCase())) continue
    if (!r.t.trim()) continue
    console.log(`  y=${String(r.y).padStart(4)} x=${String(r.x).padStart(4)} ${r.size}pt ${r.font.padEnd(22)} ${JSON.stringify(r.t)}`)
  }
})
