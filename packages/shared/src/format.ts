/**
 * Number formatting matched to the reference bill.
 *
 * The reference prints grouped values in the Amount / Rate / Total cells
 * ("4,850.00", "16,579.00") but ungrouped values inside the totals block and
 * the HSN summary table ("14050.00", "1264.50", "337.50"). Both helpers exist
 * so the printed invoice reproduces that exactly.
 */

export const grouped = (n: number, decimals = 2): string =>
  n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

export const plain = (n: number, decimals = 2): string => n.toFixed(decimals)

/** Rate column: "750", "4,850", "1,237.50" */
export const rateText = (n: number): string =>
  Number.isInteger(n) ? grouped(n, 0) : grouped(n, 2)

/** Quantity column: "5 Ltrs", "1 No" */
export const qtyText = (qty: number, unit: string): string => {
  const q = Number.isInteger(qty) ? String(qty) : String(qty)
  return unit ? `${q} ${unit}` : q
}

/** Screen-only currency, e.g. "₹ 16,579.00" */
export const money = (n: number): string => `₹ ${grouped(n)}`

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Rates are kept to four decimals so that a bargained total divides back out
 * cleanly: 10,000 over 3 units gives 3333.3333, which multiplies to 10,000.00
 * rather than 9,999.99.
 */
export const round4 = (n: number): number => Math.round((n + Number.EPSILON) * 10000) / 10000

export const todayDotted = (): string => {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}
