const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const twoDigits = (n: number): string => {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return TENS[t] + (o ? ' ' + ONES[o] : '')
}

/**
 * Indian numbering, Tally-style wording:
 *   16579 -> "Sixteen Thousand Five Hundred and Seventy Nine"
 *    2529 -> "Two Thousand Five Hundred and Twenty Nine"
 *   16079 -> "Sixteen Thousand and Seventy Nine"
 * The "and" sits before the final chunk whenever something precedes it.
 */
export const numberToWords = (value: number): string => {
  const n = Math.floor(Math.abs(value))
  if (n === 0) return 'Zero'

  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const hundred = Math.floor((n % 1000) / 100)
  const rest = n % 100

  const parts: string[] = []
  if (crore) parts.push(`${numberToWords(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (hundred) parts.push(`${ONES[hundred]} Hundred`)

  if (rest) {
    if (parts.length) parts.push('and')
    parts.push(twoDigits(rest))
  }
  return parts.join(' ')
}

/** "Rs. Sixteen Thousand Five Hundred and Seventy Nine Only" */
export const rupeesInWords = (value: number): string => {
  const rupees = Math.floor(Math.abs(value))
  const paise = Math.round((Math.abs(value) - rupees) * 100)
  let out = `Rs. ${numberToWords(rupees)}`
  if (paise > 0) out += ` and Paise ${numberToWords(paise)}`
  return `${out} Only`
}

/** "Two Thousand Five Hundred and Twenty Nine Only" — no "Rs." prefix on the tax line */
export const taxInWords = (value: number): string => {
  const rupees = Math.floor(Math.abs(value))
  const paise = Math.round((Math.abs(value) - rupees) * 100)
  let out = numberToWords(rupees)
  if (paise > 0) out += ` and Paise ${numberToWords(paise)}`
  return `${out} Only`
}
