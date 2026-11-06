import signatureAsset from '../assets/signature.png'
import type { Seller } from './types'

/**
 * The "from" company — printed verbatim at the top of every invoice.
 *
 * Transcribed from the client's clean printed sample, which is the authority
 * for all of it — a GSTIN belongs to the business, not to the bill, so it is
 * the same on every invoice and never needs to vary.
 *
 * One caveat on the GSTIN. Every GSTIN carries a check digit in its last
 * character, computed from the fourteen before it. 33BHPFN5396M1ZS does not
 * pass that check: those fourteen characters work out to a final 2, not S.
 * They are unambiguous in the sample, so either their own Tally setup has it
 * mistyped or one character of the printed number is not what it appears. The
 * PAN inside it is at least consistent with the firm (F = partnership firm,
 * N = Naveen). Worth settling against the GST registration certificate before
 * the first real invoice, since a wrong GSTIN costs the buyer their input
 * credit. Settings → Your firm → Edit corrects it without a code change.
 */
export const SELLER: Seller = {
  name: 'NAVEEN AIRTECH',
  addressLines: ['No.7/15, Jayaraman Street,', 'Gokulapuram,', 'Chengalpattu - 603 001'],
  cell: 'Cell : 99943 44413, 9626468081',
  email: 'Email : knaveenairtech@gmail.com',
  gstin: 'GSTIN: 33BHPFN5396M1ZS',
  state: 'Tamil Nadu',
  bankLine:
    'Bank Details : State Bank of India, Chengalpattu Branch, Ac No:31464906535, IFSC Code : SBIN0000824',
  declaration: [
    'We declare that this invoice shows the actual price of the goods described and that',
    'all particulars are true and correct.',
  ],
  signature: signatureAsset,
}

/** Home state of the seller. Buyers here get CGST+SGST; everyone else gets IGST. */
export const HOME_STATE = 'Tamil Nadu'

export const INDIAN_STATES = [
  'Tamil Nadu',
  'Puducherry',
  'Andhra Pradesh',
  'Karnataka',
  'Kerala',
  'Telangana',
  'Maharashtra',
  'Gujarat',
  'Delhi',
  'Haryana',
  'Uttar Pradesh',
  'West Bengal',
  'Rajasthan',
  'Madhya Pradesh',
  'Odisha',
  'Punjab',
  'Goa',
  'Jharkhand',
  'Chhattisgarh',
  'Bihar',
  'Assam',
  'Uttarakhand',
  'Himachal Pradesh',
]
