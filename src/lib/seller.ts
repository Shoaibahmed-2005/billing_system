import signatureAsset from '../assets/signature.png'
import type { Seller } from './types'

/**
 * The "from" company — printed verbatim at the top of every invoice.
 *
 * Transcribed from the client's clean printed sample. The GSTIN, the second
 * phone number and the bank account number were all misread off the original
 * blurry photo and corrected against that sample; they are worth checking
 * against a document before the first real invoice goes out.
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
