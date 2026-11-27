import type { Company, Invoice, Product, Seller } from '../types'
import { SELLER as DEFAULT_SELLER } from '../seller'
import type { Amc } from '../amc'
import { DEFAULT_REMINDERS, type ReminderSettings } from '../reminders'
import { SEED_COMPANIES, SEED_PRODUCTS, seedIds } from '../seed'
import type { Backend } from './types'

/** Browser storage on this machine — the default until Supabase is configured. */

const KEY = {
  products: 'nat.products',
  companies: 'nat.companies',
  invoices: 'nat.invoices',
  amcs: 'nat.amcs',
  seller: 'nat.seller',
  reminders: 'nat.reminders',
  seeded: 'nat.seeded.v1',
} as const

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const localBackend: Backend = {
  name: 'local',

  async ensureSeeded() {
    if (localStorage.getItem(KEY.seeded)) return
    write(KEY.products, SEED_PRODUCTS)
    write(KEY.companies, SEED_COMPANIES)
    write(KEY.invoices, [])
    localStorage.setItem(KEY.seeded, '1')
  },

  async countDemoRows() {
    const ids = seedIds()
    return (
      read<Product[]>(KEY.products, []).filter((p) => ids.has(p.id)).length +
      read<Company[]>(KEY.companies, []).filter((c) => ids.has(c.id)).length
    )
  },

  async clearForHandover() {
    const ids = seedIds()
    write(KEY.products, read<Product[]>(KEY.products, []).filter((p) => !ids.has(p.id)))
    write(KEY.companies, read<Company[]>(KEY.companies, []).filter((c) => !ids.has(c.id)))
    write(KEY.invoices, [])
    // already set, but a cleared browser must not re-seed either
    localStorage.setItem(KEY.seeded, '1')
  },

  async listProducts() {
    return read<Product[]>(KEY.products, []).sort((a, b) => a.name.localeCompare(b.name))
  },

  async saveProduct(p) {
    const all = read<Product[]>(KEY.products, [])
    const i = all.findIndex((x) => x.id === p.id)
    if (i >= 0) all[i] = p
    else all.push(p)
    write(KEY.products, all)
    return p
  },

  async deleteProduct(id) {
    write(
      KEY.products,
      read<Product[]>(KEY.products, []).filter((p) => p.id !== id),
    )
  },

  async listCompanies() {
    return read<Company[]>(KEY.companies, []).sort((a, b) => a.name.localeCompare(b.name))
  },

  async saveCompany(c) {
    const all = read<Company[]>(KEY.companies, [])
    const i = all.findIndex((x) => x.id === c.id)
    if (i >= 0) all[i] = c
    else all.push(c)
    write(KEY.companies, all)
    return c
  },

  async deleteCompany(id) {
    write(
      KEY.companies,
      read<Company[]>(KEY.companies, []).filter((c) => c.id !== id),
    )
  },

  async listInvoices() {
    return read<Invoice[]>(KEY.invoices, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async getInvoice(id) {
    return read<Invoice[]>(KEY.invoices, []).find((i) => i.id === id)
  },

  async saveInvoice(inv) {
    const all = read<Invoice[]>(KEY.invoices, [])
    const i = all.findIndex((x) => x.id === inv.id)
    if (i >= 0) all[i] = inv
    else all.push(inv)
    write(KEY.invoices, all)
    return inv
  },

  async deleteInvoice(id) {
    write(
      KEY.invoices,
      read<Invoice[]>(KEY.invoices, []).filter((i) => i.id !== id),
    )
  },

  async listAmcs() {
    return read<Amc[]>(KEY.amcs, []).sort((a, b) => a.endDate.localeCompare(b.endDate))
  },

  async saveAmc(a) {
    const all = read<Amc[]>(KEY.amcs, [])
    const i = all.findIndex((x) => x.id === a.id)
    if (i >= 0) all[i] = a
    else all.push(a)
    write(KEY.amcs, all)
    return a
  },

  async deleteAmc(id) {
    write(KEY.amcs, read<Amc[]>(KEY.amcs, []).filter((a) => a.id !== id))
  },

  async getReminders() {
    return { ...DEFAULT_REMINDERS, ...read<Partial<ReminderSettings>>(KEY.reminders, {}) }
  },

  async saveReminders(r) {
    write(KEY.reminders, r)
    return r
  },

  async getSeller() {
    return { ...DEFAULT_SELLER, ...read<Partial<Seller>>(KEY.seller, {}) }
  },

  async saveSeller(s) {
    write(KEY.seller, s)
    return s
  },

  async resetSeller() {
    localStorage.removeItem(KEY.seller)
    return DEFAULT_SELLER
  },

  async clearAllData() {
    write(KEY.products, [])
    write(KEY.companies, [])
    write(KEY.invoices, [])
    localStorage.setItem(KEY.seeded, '1')
  },

  async reloadSeedData() {
    write(KEY.products, SEED_PRODUCTS)
    write(KEY.companies, SEED_COMPANIES)
    localStorage.setItem(KEY.seeded, '1')
  },
}
