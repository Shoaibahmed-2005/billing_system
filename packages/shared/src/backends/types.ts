import type { Amc } from '../amc'
import type { Quotation } from '../quote'
import type { ReminderSettings } from '../reminders'
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

  listQuotations(): Promise<Quotation[]>
  saveQuotation(q: Quotation): Promise<Quotation>
  deleteQuotation(id: string): Promise<void>

  listAmcs(): Promise<Amc[]>
  saveAmc(a: Amc): Promise<Amc>
  deleteAmc(id: string): Promise<void>

  getReminders(): Promise<ReminderSettings>
  saveReminders(r: ReminderSettings): Promise<ReminderSettings>

  getSeller(): Promise<Seller>
  saveSeller(s: Seller): Promise<Seller>
  resetSeller(): Promise<Seller>

  clearAllData(): Promise<void>
  reloadSeedData(): Promise<void>

  /** how many of the shipped demo products and companies are still there */
  countDemoRows(): Promise<number>

  /**
   * Handover: deletes the demo products and companies by id, deletes the
   * bills raised while testing, and makes sure the demo never comes back.
   * Rows the client added are not touched.
   */
  clearForHandover(): Promise<void>
}
