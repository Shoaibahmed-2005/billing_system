import type { Company, Invoice, Product, Seller } from '../types'

/**
 * Every screen talks to the app through this one interface, so swapping
 * localStorage for Supabase is a single line in `store.ts`.
 */
export interface Backend {
  readonly name: 'local' | 'supabase'

  ensureSeeded(): Promise<void>

  listProducts(): Promise<Product[]>
  saveProduct(p: Product): Promise<Product>
  deleteProduct(id: string): Promise<void>

  listCompanies(): Promise<Company[]>
  saveCompany(c: Company): Promise<Company>
  deleteCompany(id: string): Promise<void>

  listInvoices(): Promise<Invoice[]>
  getInvoice(id: string): Promise<Invoice | undefined>
  saveInvoice(inv: Invoice): Promise<Invoice>
  deleteInvoice(id: string): Promise<void>

  getSeller(): Promise<Seller>
  saveSeller(s: Seller): Promise<Seller>
  resetSeller(): Promise<Seller>

  clearAllData(): Promise<void>
  reloadSeedData(): Promise<void>
}
