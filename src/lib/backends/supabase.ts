import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Company, Invoice, Product, Seller } from '../types'
import { SELLER as DEFAULT_SELLER } from '../seller'
import { SEED_COMPANIES, SEED_PRODUCTS } from '../seed'
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

type InvoiceRow = {
  id: string
  invoice_no: string
  meta: Invoice['meta']
  buyer: Company
  items: Invoice['items']
  tax_mode: Invoice['taxMode']
  tax_mode_auto: boolean
  grand_total: number
  created_at: string
}

const toInvoice = (r: InvoiceRow): Invoice => ({
  id: r.id,
  meta: r.meta,
  buyer: r.buyer,
  items: r.items,
  taxMode: r.tax_mode,
  taxModeAuto: r.tax_mode_auto,
  grandTotal: Number(r.grand_total),
  createdAt: r.created_at,
})

const fromInvoice = (i: Invoice): InvoiceRow => ({
  id: i.id,
  invoice_no: i.meta.invoiceNo,
  meta: i.meta,
  buyer: i.buyer,
  items: i.items,
  tax_mode: i.taxMode,
  tax_mode_auto: i.taxModeAuto,
  grand_total: i.grandTotal,
  created_at: i.createdAt,
})

/* ----------------------------------------------------------------- backend */

export const supabaseBackend: Backend = {
  name: 'supabase',

  /** Fills an empty database with the demo catalogue on first run. */
  async ensureSeeded() {
    const db = supabase()
    const { count, error } = await db
      .from('products')
      .select('id', { count: 'exact', head: true })
    fail('checking products', error)
    if ((count ?? 0) > 0) return

    fail('seeding products', (await db.from('products').insert(SEED_PRODUCTS.map(fromProduct))).error)
    fail(
      'seeding companies',
      (await db.from('companies').insert(SEED_COMPANIES.map(fromCompany))).error,
    )
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
