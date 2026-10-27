import type { Seller } from './types'

/**
 * The "from" company never changes — it is printed verbatim on every invoice.
 * Transcribed exactly from the reference bill.
 */
export const SELLER: Seller = {
  name: 'NAVEEN AIRTECH',
  addressLines: ['No.7/15, Jayaraman Street,', 'Gokulapuram,', 'Chengalpattu - 603 001'],
  cell: 'Cell : 99943 44413, 9626458081',
  email: 'Email : knaveenairtech@gmail.com',
  gstin: 'GSTIN: 33BHFPK3895N1ZS',
  state: 'Tamil Nadu',
  bankLine:
    'Bank Details : State Bank of India, Chengalpattu Branch, A/c No:31464906335, IFSC Code : SBIN0000824',
  declaration: [
    'We declare that this invoice shows the actual price of the goods described and that',
    'all particulars are true and correct.',
  ],
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
