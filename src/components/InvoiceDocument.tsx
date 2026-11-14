import { useState } from 'react'
import type { Company, InvoiceItem, InvoiceMeta, Seller } from '../lib/types'
import type { InvoiceCalc } from '../lib/gst'
import { grouped, plain, qtyText, rateText, round4 } from '../lib/format'
import { COL, HSN_COL, columnScale, fitScale, scaleStyle } from '../lib/fit'
import { rupeesInWords, taxInWords } from '../lib/words'

interface Props {
  meta: InvoiceMeta
  seller: Seller
  buyer: Company | null
  items: InvoiceItem[]
  calc: InvoiceCalc
  className?: string
  /**
   * The authorised signature to print. Left out when they would rather sign
   * the sheet by hand after printing.
   */
  signature?: string | null
  /** turns the Quantity / Rate / Amount cells into inputs for bargaining */
  editable?: boolean
  onPatchItem?: (lineId: string, patch: Partial<InvoiceItem>) => void
  /** called when a Sub Total / Total cell is focused, to snapshot the lines */
  onBeginTotalEdit?: () => void
  /** a figure typed onto the Sub Total or Total line */
  onSetTotal?: (target: number, which: 'sub' | 'grand') => void
}

/**
 * The printed bill. Laid out to match the client's existing Tally invoice
 * line for line — column widths, rule placement and number formatting all
 * come from the reference scan.
 *
 * With `editable`, the same document doubles as the bargaining screen: the
 * figures become inputs and whatever is typed flows straight back through the
 * GST calculation, so tax and totals follow the final agreed price.
 */
export default function InvoiceDocument({
  meta,
  seller,
  buyer,
  items,
  calc,
  className = '',
  signature = null,
  editable = false,
  onPatchItem,
  onBeginTotalEdit,
  onSetTotal,
}: Props) {
  const intra = calc.taxMode === 'intra'

  /*
    Type sizes, settled before a single cell is drawn.

    A figure that is wider than its column used to print straight over the
    rule — any total past a lakh did it, and the client noticed. So every
    column is measured against its longest figure and, if that will not fit,
    the whole column steps down to a size that does. On an ordinary bill
    nothing moves; "2,11,83,445.00" brings the Amount column down a quarter.

    Per column, not per cell: a column with two or three type sizes running
    down it looks like a fault even when every figure is inside its rules.
  */
  const goods = items.filter((i) => i.kind !== 'service')
  const taxWidth = intra ? Math.min(HSN_COL.amount, HSN_COL.amount2) : HSN_COL.wideAmount
  const sz = {
    hsn: scaleStyle(columnScale(items.map((i) => i.hsn), COL.hsn)),
    qty: scaleStyle(columnScale(goods.map((i) => qtyText(i.qty, i.unit)), COL.qty)),
    rate: scaleStyle(columnScale(goods.map((i) => rateText(i.rate)), COL.rate)),
    per: scaleStyle(columnScale(goods.map((i) => i.per), COL.per)),
    /* the Amount column runs the whole way down, items and totals alike */
    amt: scaleStyle(
      Math.min(
        columnScale(
          [
            ...calc.lines.map((l) => grouped(l.taxable)),
            plain(calc.subTotal),
            plain(calc.roundOff),
            ...(intra ? [plain(calc.cgst), plain(calc.sgst)] : [plain(calc.igst)]),
          ],
          COL.amt,
        ),
        fitScale(grouped(calc.grandTotal), COL.amt, 700),
      ),
    ),
    taxable: scaleStyle(
      Math.min(
        columnScale(calc.hsnRows.map((r) => plain(r.taxable)), HSN_COL.taxable),
        fitScale(plain(calc.subTotal), HSN_COL.taxable, 700),
      ),
    ),
    /* CGST and SGST share a size, so the same figure is never printed twice
       at two sizes next to each other */
    tax: scaleStyle(
      Math.min(
        columnScale(
          intra
            ? calc.hsnRows.flatMap((r) => [plain(r.cgst), plain(r.sgst)])
            : calc.hsnRows.map((r) => plain(r.igst)),
          taxWidth,
        ),
        columnScale(
          intra ? [plain(calc.cgst), plain(calc.sgst)] : [plain(calc.igst)],
          taxWidth,
          700,
        ),
      ),
    ),
  }

  const patch = (lineId: string, p: Partial<InvoiceItem>) => onPatchItem?.(lineId, p)

  /** Typing a final amount works backwards to the rate, so GST stays correct. */
  const setAmount = (it: InvoiceItem, amount: number) => {
    if (it.kind === 'service' || it.qty <= 0) patch(it.lineId, { qty: 1, rate: round4(amount) })
    else patch(it.lineId, { rate: round4(amount / it.qty) })
  }

  /**
   * Typing a figure straight onto Sub Total or Total spreads it back across the
   * lines in proportion — how a counter actually bargains: "make it twenty
   * thousand all-in". GST is recalculated from the new line values.
   */

  return (
    <div className={`inv ${editable ? 'inv-editable' : ''} ${className}`}>
      <div className="inv-title">Tax Invoice</div>
      <div className="inv-subtitle">Invoice Cum Delivery Challan</div>

      <div className="inv-box">
        {/* ------------------------------------------------------- header */}
        <div className="inv-head">
          <div className="inv-head-left">
            <div className="party party-seller">
              <div className="seller-name">{seller.name}</div>
              {seller.addressLines.map((l, i) => (
                <div className="party-line" key={i}>
                  {l}
                </div>
              ))}
              <div className="party-line">{seller.cell}</div>
              <div className="party-line">{seller.email}</div>
              <div className="party-line">{seller.gstin}</div>
            </div>

            <div className="party party-consignee">
              <div className="party-label">Consignee</div>
              <div className="party-name">{buyer ? `${buyer.name},` : ''}</div>
              {(buyer?.addressLines ?? []).map((l, i) => (
                <div className="party-line" key={i}>
                  {l}
                </div>
              ))}
              {buyer?.gstin ? <div className="party-line">GST: {buyer.gstin}</div> : null}
            </div>
          </div>

          <div className="inv-head-right">
            <div className="meta-row">
              <div className="meta-cell split-left">
                <span className="meta-label">Invoice No.</span>
                <span className="meta-value">{meta.invoiceNo}</span>
              </div>
              <div className="meta-cell split-right">
                <span className="meta-label">Dated</span>
                <span className="meta-value">{meta.dated}</span>
              </div>
            </div>

            <div className="meta-row tall">
              <div className="meta-cell">
                <span className="meta-label">Mode/Terms of Payment</span>
                <span className="meta-value">{meta.modeTerms}</span>
              </div>
            </div>

            <div className="meta-row tall">
              <div className="meta-cell">
                <span className="meta-label">Customer PO No.</span>
                <span className="meta-value">{meta.customerPoNo}</span>
              </div>
            </div>

            <div className="meta-row">
              <div className="meta-cell split-left">
                <span className="meta-label">Despatch Through</span>
                <span className="meta-value">{meta.despatchThrough}</span>
              </div>
              <div className="meta-cell split-right">
                <span className="meta-label">Destination</span>
                <span className="meta-value">{meta.destination}</span>
              </div>
            </div>

            <div className="meta-row">
              <div className="meta-cell split-left">
                <span className="meta-label">Terms of Delivery</span>
                <span className="meta-value">{meta.termsOfDelivery}</span>
              </div>
              <div className="meta-cell split-right" />
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------- items */}
        <div className="items-wrap">
          <table className="items">
            <Cols />
            <thead>
              <tr>
                <th className="c-sl">Sl.No</th>
                <th className="c-desc">Description of Goods</th>
                <th className="c-hsn">HSN/SAC</th>
                <th className="c-qty">Quantity</th>
                <th className="c-rate">Rate</th>
                <th className="c-per">Per</th>
                <th className="c-amt">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const line = calc.lines[idx]
                const isService = it.kind === 'service'
                const amount = line?.taxable ?? 0
                // measured against the column so a lakh-scale figure shrinks
                // rather than running over the rule
                const qtyStr = isService ? '' : qtyText(it.qty, it.unit)
                const rateStr = isService ? '' : rateText(it.rate)
                const amtStr = grouped(amount)
                return (
                  <tr className="item" key={it.lineId}>
                    <td className="c-sl">{idx + 1}</td>
                    <td className="c-desc">{it.description}</td>
                    <td className="c-hsn" style={sz.hsn}>
                      {it.hsn}
                    </td>
                    <td className="c-qty" style={sz.qty}>
                      {isService ? (
                        ''
                      ) : editable ? (
                        <span className="qty-wrap">
                          <NumCell
                            value={it.qty}
                            format={(n) => String(n)}
                            onChange={(n) => patch(it.lineId, { qty: n })}
                            className="inv-in inv-in-qty"
                          />
                          <span>{it.unit}</span>
                        </span>
                      ) : (
                        qtyStr
                      )}
                    </td>
                    <td className="c-rate" style={sz.rate}>
                      {isService ? (
                        ''
                      ) : editable ? (
                        <NumCell
                          value={it.rate}
                          format={rateText}
                          onChange={(n) => patch(it.lineId, { rate: n })}
                          className="inv-in inv-in-r"
                        />
                      ) : (
                        rateStr
                      )}
                    </td>
                    <td className="c-per" style={sz.per}>
                      {isService ? '' : it.per}
                    </td>
                    <td className="c-amt" style={sz.amt}>
                      {editable ? (
                        <NumCell
                          value={amount}
                          format={(n) => grouped(n)}
                          onChange={(n) => setAmount(it, n)}
                          className="inv-in inv-in-r"
                        />
                      ) : (
                        amtStr
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* grows to push the totals onto the foot of the page */}
          <table className="items items-fill">
            <Cols />
            <tbody>
              <tr className="filler">
                <td className="c-sl" />
                <td className="c-desc" />
                <td className="c-hsn" />
                <td className="c-qty" />
                <td className="c-rate" />
                <td className="c-per" />
                <td className="c-amt" />
              </tr>
            </tbody>
          </table>

          <table className="items">
            <Cols />
            <tbody>
              <tr className="subtotal">
                <td className="c-sl" />
                <td className="c-desc" />
                <td className="c-hsn" />
                <td className="c-qty" />
                <td className="c-rate" />
                <td className="c-per" />
                <td className="c-amt" style={sz.amt}>
                  {editable ? (
                    <NumCell
                      value={calc.subTotal}
                      format={plain}
                      onBeginEdit={onBeginTotalEdit}
                      onChange={(n) => onSetTotal?.(n, 'sub')}
                      className="inv-in inv-in-r"
                    />
                  ) : (
                    plain(calc.subTotal)
                  )}
                </td>
              </tr>

              {intra ? (
                <>
                  <tr className="taxrow">
                    <td className="c-sl" />
                    <td className="c-desc">CGST</td>
                    <td className="c-hsn" />
                    <td className="c-qty" />
                    <td className="c-rate" />
                    <td className="c-per" />
                    <td className="c-amt" style={sz.amt}>{plain(calc.cgst)}</td>
                  </tr>
                  <tr className="taxrow">
                    <td className="c-sl" />
                    <td className="c-desc">SGST</td>
                    <td className="c-hsn" />
                    <td className="c-qty" />
                    <td className="c-rate" />
                    <td className="c-per" />
                    <td className="c-amt" style={sz.amt}>{plain(calc.sgst)}</td>
                  </tr>
                </>
              ) : (
                <tr className="taxrow">
                  <td className="c-sl" />
                  <td className="c-desc">IGST</td>
                  <td className="c-hsn" />
                  <td className="c-qty" />
                  <td className="c-rate" />
                  <td className="c-per" />
                  <td className="c-amt" style={sz.amt}>{plain(calc.igst)}</td>
                </tr>
              )}

              <tr className="taxrow">
                <td className="c-sl" />
                <td className="c-desc">Rounded Off</td>
                <td className="c-hsn" />
                <td className="c-qty" />
                <td className="c-rate" />
                <td className="c-per" />
                <td className="c-amt" style={sz.amt}>{plain(calc.roundOff)}</td>
              </tr>

              <tr className="grand">
                <td className="c-sl" />
                <td className="c-desc">Total</td>
                <td className="c-hsn" />
                <td className="c-qty" />
                <td className="c-rate" />
                <td className="c-per" />
                <td className="c-amt" style={sz.amt}>
                  {editable ? (
                    <NumCell
                      value={calc.grandTotal}
                      format={(n) => grouped(n)}
                      onBeginEdit={onBeginTotalEdit}
                      onChange={(n) => onSetTotal?.(n, 'grand')}
                      className="inv-in inv-in-r"
                    />
                  ) : (
                    grouped(calc.grandTotal)
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* -------------------------------------------------------- words */}
        <div className="amount-words">
          <span className="label">Amount Chargeable (in words)</span>
          <span className="value">{rupeesInWords(calc.grandTotal)}</span>
        </div>

        {/* ---------------------------------------------------- hsn table */}
        {/*
          Same seven columns as the items table above — that shared grid is
          why the two tables line up on the printed sheet. The summary just
          spans them differently: HSN/SAC over cols 1-2, Taxable Value on
          col 3, and a tax pair on cols 4-5 and 6-7.
        */}
        <table className="hsn">
          <Cols />
          <thead>
            <tr>
              <th colSpan={2}>HSN/SAC</th>
              <th>
                Taxable
                <br />
                Value
              </th>
              {intra ? (
                <>
                  <th colSpan={2}>Central Tax</th>
                  <th colSpan={2}>State Tax</th>
                </>
              ) : (
                <th colSpan={4}>Integrated Tax</th>
              )}
            </tr>
            <tr>
              <td />
              <td />
              <td />
              {intra ? (
                <>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </>
              ) : (
                <>
                  <th colSpan={2}>Rate</th>
                  <th colSpan={2}>Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {calc.hsnRows.map((r) => (
              <tr key={`${r.hsn}-${r.gstRate}`}>
                <td />
                <td className="h-hsn">{r.hsn}</td>
                <td className="h-tv" style={sz.taxable}>{plain(r.taxable)}</td>
                {intra ? (
                  <>
                    <td className="h-rate">{r.gstRate / 2}%</td>
                    <td className="h-amt" style={sz.tax}>{plain(r.cgst)}</td>
                    <td className="h-rate">{r.gstRate / 2}%</td>
                    <td className="h-amt" style={sz.tax}>{plain(r.sgst)}</td>
                  </>
                ) : (
                  <>
                    <td className="h-rate" colSpan={2}>
                      {r.gstRate}%
                    </td>
                    <td className="h-amt" colSpan={2} style={sz.tax}>
                      {plain(r.igst)}
                    </td>
                  </>
                )}
              </tr>
            ))}
            <tr className="hsn-total">
              <td />
              <td className="total-label">Total</td>
              <td className="h-tv" style={sz.taxable}>{plain(calc.subTotal)}</td>
              {intra ? (
                <>
                  <td className="h-rate" />
                  <td className="h-amt" style={sz.tax}>{plain(calc.cgst)}</td>
                  <td className="h-rate" />
                  <td className="h-amt" style={sz.tax}>{plain(calc.sgst)}</td>
                </>
              ) : (
                <>
                  <td className="h-rate" colSpan={2} />
                  <td className="h-amt" colSpan={2} style={sz.tax}>
                    {plain(calc.igst)}
                  </td>
                </>
              )}
            </tr>
          </tbody>
        </table>

        <div className="tax-words">
          Tax Amount (in Words) : <b>{taxInWords(calc.totalTax)}</b>
        </div>

        {/* ------------------------------------------------------- footer */}
        <div className="inv-foot">
          <div className="declaration">
            <div className="d-title">Declaration</div>
            {seller.declaration.map((l, i) => (
              <div className="d-line" key={i}>
                {l}
              </div>
            ))}
          </div>
          <div className="sign">
            <div className="for-name">for {toTitle(seller.name)}</div>
            <div className="sign-slot">
              {signature ? <img src={signature} alt="" /> : null}
            </div>
            <div className="signatory">Authorised Signatory</div>
          </div>
        </div>

        <div className="bank">{seller.bankLine}</div>
      </div>
    </div>
  )
}

/**
 * Shows the figure formatted exactly as it prints, then swaps to the raw number
 * the moment it is focused so it can be typed over cleanly.
 */
function NumCell({
  value,
  format,
  onChange,
  className,
  onBeginEdit,
}: {
  value: number
  format: (n: number) => string
  onChange: (n: number) => void
  className: string
  /** fires once when the cell is focused, before any keystroke */
  onBeginEdit?: () => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const parse = (raw: string): number | null => {
    const n = Number(raw.replace(/,/g, ''))
    return raw.trim() !== '' && !Number.isNaN(n) && n >= 0 ? n : null
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={draft ?? format(value)}
      onFocus={(e) => {
        onBeginEdit?.()
        setDraft(String(value))
        const el = e.currentTarget
        window.requestAnimationFrame(() => el.select())
      }}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        const n = parse(raw)
        if (n !== null) onChange(n)
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function Cols() {
  return (
    <colgroup>
      <col className="c-sl" />
      <col className="c-desc" />
      <col className="c-hsn" />
      <col className="c-qty" />
      <col className="c-rate" />
      <col className="c-per" />
      <col className="c-amt" />
    </colgroup>
  )
}

const toTitle = (s: string) =>
  s
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
