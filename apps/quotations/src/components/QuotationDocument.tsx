import { Fragment } from 'react'
import type { Company, Seller } from '@naveen/shared/types'
import type { QuoteItem, QuoteMeta } from '@naveen/shared/quote'
import { calcQuote, quoteLineValue } from '@naveen/shared/quote'
import { grouped, rateText } from '@naveen/shared/format'

interface Props {
  meta: QuoteMeta
  seller: Seller
  buyer: Company | null
  items: QuoteItem[]
  className?: string
  /**
   * The authorised signature to print. Left out when they would rather sign
   * the sheet by hand after printing — the space stays the same either way,
   * so the page does not shift when it is turned off.
   */
  signature?: string | null
  /** blank rows, so a short quotation still fills the sheet like the sample */
  fillTo?: number
}

/**
 * The printed quotation, in whichever of the firm's two layouts was chosen.
 *
 * They are genuinely two documents, not one with switches: the spares sheet
 * prices the job and totals it, the machine sheet quotes against each line
 * and says "GST 18% Extra" instead of adding anything up. Even the headings
 * differ — Particulars against DESCRIPTION, Unit Price against EACH — so the
 * tables are written out separately rather than driven from a table of
 * labels. It is more lines of code and far easier to hold against the
 * samples.
 *
 * The geometry is in quotation.css, measured off their own PDFs.
 */
export default function QuotationDocument({
  meta,
  seller,
  buyer,
  items,
  className = '',
  signature = null,
  fillTo = 0,
}: Props) {
  const machine = meta.template === 'machine'
  const calc = calcQuote(items, meta.gstRate)
  const blanks = Math.max(0, fillTo - items.length)

  return (
    <div className={`quo ${machine ? 'quo-machine' : 'quo-spares'} ${className}`}>
      <div className="quo-box">
        <div className="quo-inner">
          <div className="quo-seller">
            <div className="name">{seller.name}</div>
            {seller.addressLines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            <div>{seller.cell}</div>
            {/* the spares sheet leaves the email off; the machine one carries it */}
            {machine ? <div>{seller.email}</div> : null}
            <div>{seller.gstin}</div>
          </div>

          <div className="quo-title">QUOTATION</div>

          {machine ? (
            <>
              <div className="quo-date-line">Date : {meta.dated}</div>
              <div className="quo-to">To</div>
              <div className="quo-to-address">
                {buyer ? (
                  <>
                    <div>{buyer.name},</div>
                    {buyer.addressLines.map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </>
                ) : (
                  <div>&nbsp;</div>
                )}
              </div>
              {meta.subject ? <div className="quo-subject">Sub: {meta.subject}</div> : null}
            </>
          ) : (
            <div className="quo-head">
              <div className="quo-head-left">
                <div>Consignee</div>
                {buyer ? (
                  <>
                    <div>{buyer.name},</div>
                    {buyer.addressLines.map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </>
                ) : null}
              </div>
              <div className="quo-head-right">
                <div className="quo-ref">
                  <span>SI No</span>
                  <span>:</span>
                  <span>{meta.slNo}</span>
                  <span>Date</span>
                  <span>:</span>
                  <span>{meta.dated}</span>
                  <span>Ref</span>
                  <span>:</span>
                  <span>{meta.ref}</span>
                  <span>Date</span>
                  <span>:</span>
                  <span>{meta.refDate}</span>
                </div>
              </div>
            </div>
          )}

          <div className="quo-greeting">
            <div>Dear Sir,</div>
            <div className="lead">
              We thank you for the enquiry and interest shown in our{' '}
              {machine ? 'products' : 'Products'} and have pleasure in quoting the following :
            </div>
          </div>

          {machine ? (
            <table className="quo-items">
              <thead>
                <tr>
                  <th className="c-sl">SL NO.</th>
                  <th className="c-desc">DESCRIPTION</th>
                  <th className="c-hsn">HSN/SAC</th>
                  <th className="c-unit">QTY</th>
                  <th className="c-rate">EACH</th>
                  <th className="c-value">AMOUNT (R.S)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr className="q-item" key={item.lineId}>
                    <td className="c-sl">{i + 1}</td>
                    <td className="c-desc">{item.description}</td>
                    <td className="c-hsn">{item.hsn}</td>
                    <td className="c-unit">{item.unit}</td>
                    <td className="c-rate">{rateText(item.rate)}</td>
                    <td className="c-value">{grouped(quoteLineValue(item))}</td>
                  </tr>
                ))}
                <tr className="q-extra">
                  <td colSpan={6}>GST {meta.gstRate}% Extra</td>
                </tr>
                {Array.from({ length: blanks }, (_, i) => (
                  <tr className="q-fill" key={`b${i}`}>
                    <td className="c-sl">&nbsp;</td>
                    <td className="c-desc" />
                    <td className="c-hsn" />
                    <td className="c-unit" />
                    <td className="c-rate" />
                    <td className="c-value" />
                  </tr>
                ))}
                <tr className="q-band">
                  <td className="c-sl">&nbsp;</td>
                  <td className="c-desc" />
                  <td className="c-hsn" />
                  <td className="c-unit" />
                  <td className="c-rate" />
                  <td className="c-value" />
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="quo-items">
              <thead>
                <tr>
                  <th className="c-sl">S.No.</th>
                  <th className="c-desc">Particulars</th>
                  <th className="c-hsn">HSN/SAC</th>
                  <th className="c-unit">Unit</th>
                  <th className="c-rate">Unit Price</th>
                  <th className="c-value">Value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr className="q-item" key={item.lineId}>
                    <td className="c-sl">{i + 1}</td>
                    <td className="c-desc">{item.description}</td>
                    <td className="c-hsn">{item.hsn}</td>
                    <td className="c-unit">{item.unit}</td>
                    <td className="c-rate">{rateText(item.rate)}</td>
                    <td className="c-value">{grouped(quoteLineValue(item))}</td>
                  </tr>
                ))}
                {Array.from({ length: blanks }, (_, i) => (
                  <tr className="q-fill" key={`b${i}`}>
                    <td className="c-sl">&nbsp;</td>
                    <td className="c-desc" />
                    <td className="c-hsn" />
                    <td className="c-unit" />
                    <td className="c-rate" />
                    <td className="c-value" />
                  </tr>
                ))}
                <tr className="q-sub">
                  <td className="c-sl" />
                  <td className="c-desc" />
                  <td className="c-hsn" />
                  <td className="c-unit" />
                  <td className="c-rate" />
                  <td className="c-value">{grouped(calc.subTotal)}</td>
                </tr>
                <tr className="q-gst">
                  <td className="c-sl" />
                  <td className="c-desc">GST {meta.gstRate}%</td>
                  <td className="c-hsn" />
                  <td className="c-unit" />
                  <td className="c-rate" />
                  <td className="c-value">{grouped(calc.gst)}</td>
                </tr>
                <tr className="q-total">
                  <td className="c-sl" />
                  <td className="c-desc" />
                  <td className="c-hsn" />
                  <td className="c-unit" />
                  <td className="c-rate">Total</td>
                  <td className="c-value">{grouped(calc.total)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {/* no terms, no heading — an empty TERMS block would look like a mistake */}
          <div className="quo-terms" style={meta.terms.length ? undefined : { display: 'none' }}>
            {machine ? (
              <div className="t-head-band">TERMS &amp; CONDITIONS</div>
            ) : (
              <div>
                <span className="t-head-left">TERMS &amp; CONDITIONS</span>
              </div>
            )}

            {/*
              Whatever rows this quotation was given, in the order they were
              added. A job with nothing to say about warranty has no Warranty
              line at all, rather than an empty one.
            */}
            <dl>
              {meta.terms.map((t) => (
                <Fragment key={t.id}>
                  <dt>{t.label}</dt>
                  <dd>{t.value}</dd>
                </Fragment>
              ))}
            </dl>
          </div>

          <div className="quo-close">
            <div>Thanking you,</div>
            <div>Truly yours,</div>
            <div style={{ marginTop: '2mm' }}>For {seller.name.replace(/^NAVEEN/, 'Naveen')},</div>

            <div className="quo-sign">
              <div className="quo-sign-slot">
                {signature ? <img src={signature} alt="" /> : null}
              </div>
              <div className="rule" />
              <div>{meta.signatory}</div>
              <div>{meta.signatoryTitle}</div>
              <div>{meta.signatoryCell}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
