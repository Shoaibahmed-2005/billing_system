import signatureAsset from './assets/signature.png'
import type { Seller } from './types'

/**
 * The "from" company — printed verbatim at the top of every invoice.
 *
 * A GSTIN belongs to the business, not to the bill, so it is the same on
 * every invoice and never needs to vary.
 *
 * These were first transcribed from a scan of the client's printed sample,
 * and three of them were misread off it. The firm's own quotation PDFs —
 * typed, not scanned — settle it:
 *
 *   GSTIN   33BHFPK3895N1ZS, not 33BHPFN5396M1ZS
 *   Cell    9626458081, not 9626468081
 *   Pincode 603 002, not 603 001
 *
 * The GSTIN is the one that mattered. Every GSTIN carries a check digit in
 * its last character, computed from the fourteen before it; the scanned
 * number failed that check (those fourteen work out to a final 2, not S)
 * while the one on the quotations passes. So the bills had been printing a
 * number that cannot exist, which costs the buyer their input credit.
 *
 * Still worth one look at the GST registration certificate, since a check
 * digit only proves a number is well formed, not that it is theirs.
 */
export const SELLER: Seller = {
  name: 'NAVEEN AIRTECH',
  addressLines: ['No.7/15, Jayaraman Street,', 'Gokulapuram,', 'Chengalpattu - 603 002'],
  cell: 'Cell : 99943 44413, 9626458081',
  email: 'Email : knaveenairtech@gmail.com',
  gstin: 'GSTIN: 33BHFPK3895N1ZS',
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
