export type ItemKind = 'goods' | 'service'

export interface Product {
  id: string
  name: string
  hsn: string
  unit: string // "No", "Ltrs", "Set", "Kg", "Mtr"
  per: string // "Each", "Set", "Ltr"
  rate: number
  gstRate: number // 18 means 18% total (9 CGST + 9 SGST, or 18 IGST)
  kind: ItemKind
  active: boolean
}

export interface Company {
  id: string
  name: string
  addressLines: string[]
  gstin: string
  state: string
  phone?: string
  email?: string
  active: boolean
}

export interface InvoiceItem {
  lineId: string
  productId: string | null
  description: string
  hsn: string
  qty: number
  unit: string
  rate: number
  per: string
  gstRate: number
  kind: ItemKind
}

export type TaxMode = 'intra' | 'inter'

export interface InvoiceMeta {
  invoiceNo: string
  dated: string // free text, printed as-is (dd.mm.yyyy)
  modeTerms: string
  customerPoNo: string
  despatchThrough: string
  destination: string
  termsOfDelivery: string
}

export interface Invoice {
  id: string
  meta: InvoiceMeta
  buyer: Company // snapshot at time of billing
  items: InvoiceItem[]
  taxMode: TaxMode
  taxModeAuto: boolean
  createdAt: string
  /** cached for the history list — recomputed on open */
  grandTotal: number
}

export interface Seller {
  name: string
  addressLines: string[]
  cell: string
  email: string
  gstin: string
  state: string
  bankLine: string
  declaration: string[]
}
