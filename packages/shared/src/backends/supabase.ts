import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Company, Invoice, Product, Seller } from '../types'
import { SELLER as DEFAULT_SELLER } from '../seller'
import type { Amc } from '../amc'
import type { Quotation } from '../quote'
import { DEFAULT_REMINDERS, type ReminderSettings } from '../reminders'
import { SEED_COMPANIES, SEED_PRODUCTS, seedIds } from '../seed'
import type { Backend } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasSupabaseConfig = (): boolean => Boolean(url && anonKey)

let client: SupabaseClient | null = null
export const supabase = (): SupabaseClient => {
  if (!client) {
    if (!url || !anonKey) throw new Error('Supabase is not configured')
    client = createClient(url, anonKey, {
      auth: {
        // Sign in once per machine. The session is kept in this browser's
        // storage and the token is renewed in the background, so the counter
        // opens straight to the bill on every later visit.
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'nat.auth',
        detectSessionInUrl: false,
      },
    })
  }
  return client
}

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`)
}

/* ------------------------------------------------------------ row mapping */

type ProductRow = {
  id: string
  name: string
  hsn: string
  unit: string
  per: string
  rate: number
  gst_rate: number
  kind: 'goods' | 'service'
  active: boolean
}

const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  name: r.name,
  hsn: r.hsn,
  unit: r.unit,
  per: r.per,
  rate: Number(r.rate),
  gstRate: Number(r.gst_rate),
  kind: r.kind,
  active: r.active,
})

const fromProduct = (p: Product): ProductRow => ({
  id: p.id,
  name: p.name,
  hsn: p.hsn,
  unit: p.unit,
  per: p.per,
  rate: p.rate,
  gst_rate: p.gstRate,
  kind: p.kind,
  active: p.active,
})

type CompanyRow = {
  id: string
  name: string
  address_lines: string[]
  gstin: string
  state: string
  phone: string | null
  email: string | null
  active: boolean
}

const toCompany = (r: CompanyRow): Company => ({
  id: r.id,
  name: r.name,
  addressLines: r.address_lines ?? [],
  gstin: r.gstin,
  state: r.state,
  phone: r.phone ?? undefined,
  email: r.email ?? undefined,
  active: r.active,
})

const fromCompany = (c: Company): CompanyRow => ({
  id: c.id,
  name: c.name,
  address_lines: c.addressLines,
  gstin: c.gstin,
  state: c.state,
  phone: c.phone ?? null,
  email: c.email ?? null,
  active: c.active,
})

/*
  showSignature rides inside meta rather than in a column of its own.

  There is no column for it, and the table is already live with the client's
  bills in it — adding one would mean an ALTER TABLE run by hand against
  their database before the fix did anything, which is a poor way to ship a
  two-line correction. meta is jsonb and already holds everything else typed
  on the right of the bill, so it goes there and old rows, which have no such
  key, read back as true: the signature prints, which is what they did
  before.
*/
type StoredMeta = Invoice['meta'] & { showSignature?: boolean }

type InvoiceRow = {
  id: string
  invoice_no: string
  meta: StoredMeta
  buyer: Company
  items: Invoice['items']
  tax_mode: Invoice['taxMode']
  tax_mode_auto: boolean
  grand_total: number
  created_at: string
}

const toInvoice = (r: InvoiceRow): Invoice => {
  const { showSignature, ...meta } = r.meta
  return {
    id: r.id,
    meta,
    buyer: r.buyer,
    items: r.items,
    taxMode: r.tax_mode,
    taxModeAuto: r.tax_mode_auto,
    // absent on every bill written before this, and those did print it
    showSignature: showSignature !== false,
    grandTotal: Number(r.grand_total),
    createdAt: r.created_at,
  }
}

const fromInvoice = (i: Invoice): InvoiceRow => ({
  id: i.id,
  invoice_no: i.meta.invoiceNo,
  meta: { ...i.meta, showSignature: i.showSignature !== false },
  buyer: i.buyer,
  items: i.items,
  tax_mode: i.taxMode,
  tax_mode_auto: i.taxModeAuto,
  grand_total: i.grandTotal,
  created_at: i.createdAt,
})

/*
  end_date is a plain text column holding "26.11.2027", not a date.

  It is what the counter types and what every other date in this system
  looks like, and a real date column would mean converting at both ends for
  no gain — nothing is queried by date range, only listed and compared in
  the browser. The index is on it anyway, so the ordered list is cheap.
*/
type QuotationRow = {
  id: string
  sl_no: string
  template: Quotation['meta']['template']
  dated: string
  buyer_name: string
  meta: Quotation['meta']
  buyer: Quotation['buyer']
  items: Quotation['items']
  total: number
  created_at: string
}

/*
  buyer_name and sl_no are copies of what is inside the jsonb. They are there
  so the list can be searched and sorted in the database rather than by
  pulling every quotation into the browser first, and nothing reads them
  back — toQuotation takes the document from the jsonb, which is the one
  true copy.
*/
const toQuotation = (r: QuotationRow): Quotation => ({
  id: r.id,
  meta: r.meta,
  buyer: r.buyer,
  items: r.items,
  total: Number(r.total),
  createdAt: r.created_at,
})

const fromQuotation = (q: Quotation): QuotationRow => ({
  id: q.id,
  sl_no: q.meta.slNo,
  template: q.meta.template,
  dated: q.meta.dated,
  buyer_name: q.buyer.name,
  meta: q.meta,
  buyer: q.buyer,
  items: q.items,
  total: q.total,
  created_at: q.createdAt,
})

type AmcRow = {
  id: string
  company_id: string | null
  company_name: string
  equipment: string
  product_id: string | null
  invoice_no: string
  serial_no: string
  start_date: string
  end_date: string
  amount: number | null
  notes: string
  active: boolean
  last_reminded_at: string | null
  created_at: string
}

const toAmc = (r: AmcRow): Amc => ({
  id: r.id,
  companyId: r.company_id,
  companyName: r.company_name,
  equipment: r.equipment,
  productId: r.product_id,
  invoiceNo: r.invoice_no,
  serialNo: r.serial_no,
  startDate: r.start_date,
  endDate: r.end_date,
  amount: r.amount === null ? null : Number(r.amount),
  notes: r.notes,
  active: r.active,
  lastRemindedAt: r.last_reminded_at ?? undefined,
  createdAt: r.created_at,
})

const fromAmc = (a: Amc): AmcRow => ({
  id: a.id,
  company_id: a.companyId,
  company_name: a.companyName,
  equipment: a.equipment,
  product_id: a.productId,
  invoice_no: a.invoiceNo,
  serial_no: a.serialNo,
  start_date: a.startDate,
  end_date: a.endDate,
  amount: a.amount,
  notes: a.notes,
  active: a.active,
  last_reminded_at: a.lastRemindedAt ?? null,
  created_at: a.createdAt,
})

/**
 * Records that this database has had its demo data already, so that an empty
 * catalogue is never mistaken for a fresh install.
 */
const markSeeded = (db: SupabaseClient) =>
  db.from('settings').upsert({ key: 'seeded', value: { at: new Date().toISOString() } })

/* ----------------------------------------------------------------- backend */

export const supabaseBackend: Backend = {
  name: 'supabase',

  /** Fills an empty database with the demo catalogue on first run. */
  /*
    Seeds at most once in the life of a database, recorded by a row in
    settings.

    It used to seed whenever the products table was empty, which is a trap
    with the demo data gone: the shop clears it for handover, the next page
    load finds nothing and puts all fifty-seven fake parts back. The same
    would happen to a real catalogue if its last product were ever removed.
  */
  async ensureSeeded() {
    const db = supabase()

    const { data: mark, error: markError } = await db
      .from('settings')
      .select('key')
      .eq('key', 'seeded')
      .maybeSingle()
    fail('checking the demo data', markError)
    if (mark) return

    const { count, error } = await db
      .from('products')
      .select('id', { count: 'exact', head: true })
    fail('checking products', error)

    if ((count ?? 0) === 0) {
      fail(
        'seeding products',
        (await db.from('products').insert(SEED_PRODUCTS.map(fromProduct))).error,
      )
      fail(
        'seeding companies',
        (await db.from('companies').insert(SEED_COMPANIES.map(fromCompany))).error,
      )
    }

    fail('marking the demo data', (await markSeeded(db)).error)
  },

  async listProducts() {
    const { data, error } = await supabase().from('products').select('*').order('name')
    fail('loading products', error)
    return (data as ProductRow[]).map(toProduct)
  },

  async saveProduct(p) {
    fail('saving product', (await supabase().from('products').upsert(fromProduct(p))).error)
    return p
  },

  async deleteProduct(id) {
    fail('deleting product', (await supabase().from('products').delete().eq('id', id)).error)
  },

  async listCompanies() {
    const { data, error } = await supabase().from('companies').select('*').order('name')
    fail('loading companies', error)
    return (data as CompanyRow[]).map(toCompany)
  },

  async saveCompany(c) {
    fail('saving company', (await supabase().from('companies').upsert(fromCompany(c))).error)
    return c
  },

  async deleteCompany(id) {
    fail('deleting company', (await supabase().from('companies').delete().eq('id', id)).error)
  },

  async listInvoices() {
    const { data, error } = await supabase()
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
    fail('loading invoices', error)
    return (data as InvoiceRow[]).map(toInvoice)
  },

  async getInvoice(id) {
    const { data, error } = await supabase().from('invoices').select('*').eq('id', id).maybeSingle()
    fail('loading invoice', error)
    return data ? toInvoice(data as InvoiceRow) : undefined
  },

  async saveInvoice(inv) {
    fail('saving invoice', (await supabase().from('invoices').upsert(fromInvoice(inv))).error)
    return inv
  },

  async deleteInvoice(id) {
    fail('deleting invoice', (await supabase().from('invoices').delete().eq('id', id)).error)
  },

  async listQuotations() {
    const { data, error } = await supabase()
      .from('quotations')
      .select('*')
      .order('created_at', { ascending: false })
    fail('loading quotations', error)
    return (data as QuotationRow[]).map(toQuotation)
  },

  async saveQuotation(q) {
    fail('saving the quotation', (await supabase().from('quotations').upsert(fromQuotation(q))).error)
    return q
  },

  async deleteQuotation(id) {
    fail('deleting the quotation', (await supabase().from('quotations').delete().eq('id', id)).error)
  },

  async listAmcs() {
    const { data, error } = await supabase().from('amcs').select('*').order('end_date')
    fail('loading maintenance contracts', error)
    return (data as AmcRow[]).map(toAmc)
  },

  async saveAmc(a) {
    fail('saving the contract', (await supabase().from('amcs').upsert(fromAmc(a))).error)
    return a
  },

  async deleteAmc(id) {
    fail('deleting the contract', (await supabase().from('amcs').delete().eq('id', id)).error)
  },

  async getReminders() {
    const { data, error } = await supabase()
      .from('settings')
      .select('value')
      .eq('key', 'reminders')
      .maybeSingle()
    fail('loading the reminder list', error)
    return { ...DEFAULT_REMINDERS, ...((data?.value as Partial<ReminderSettings>) ?? {}) }
  },

  async saveReminders(r) {
    fail(
      'saving the reminder list',
      (await supabase().from('settings').upsert({ key: 'reminders', value: r })).error,
    )
    return r
  },

  async getSeller() {
    const { data, error } = await supabase()
      .from('settings')
      .select('value')
      .eq('key', 'seller')
      .maybeSingle()
    fail('loading firm details', error)
    return { ...DEFAULT_SELLER, ...((data?.value as Partial<Seller>) ?? {}) }
  },

  async saveSeller(s) {
    fail(
      'saving firm details',
      (await supabase().from('settings').upsert({ key: 'seller', value: s })).error,
    )
    return s
  },

  async resetSeller() {
    fail(
      'resetting firm details',
      (await supabase().from('settings').delete().eq('key', 'seller')).error,
    )
    return DEFAULT_SELLER
  },

  async countDemoRows() {
    const db = supabase()
    const ids = [...seedIds()]
    const { count: p, error: pe } = await db
      .from('products')
      .select('id', { count: 'exact', head: true })
      .in('id', ids)
    fail('counting the demo products', pe)
    const { count: c, error: ce } = await db
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .in('id', ids)
    fail('counting the demo companies', ce)
    return (p ?? 0) + (c ?? 0)
  },

  async clearForHandover() {
    const db = supabase()
    const ids = [...seedIds()]
    fail('clearing the test bills', (await db.from('invoices').delete().neq('id', '')).error)
    fail('removing the demo products', (await db.from('products').delete().in('id', ids)).error)
    fail('removing the demo companies', (await db.from('companies').delete().in('id', ids)).error)
    fail('marking the demo data', (await markSeeded(db)).error)
  },

  async clearAllData() {
    const db = supabase()
    // `neq` on the primary key with an impossible value matches every row.
    fail('clearing invoices', (await db.from('invoices').delete().neq('id', '')).error)
    fail('clearing products', (await db.from('products').delete().neq('id', '')).error)
    fail('clearing companies', (await db.from('companies').delete().neq('id', '')).error)
  },

  async reloadSeedData() {
    const db = supabase()
    fail('restoring products', (await db.from('products').upsert(SEED_PRODUCTS.map(fromProduct))).error)
    fail(
      'restoring companies',
      (await db.from('companies').upsert(SEED_COMPANIES.map(fromCompany))).error,
    )
  },
}
