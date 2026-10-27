import { localBackend } from './backends/local'
import { hasSupabaseConfig, supabaseBackend } from './backends/supabase'
import type { Backend } from './backends/types'

/**
 * Data access layer.
 *
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example) and the
 * whole app moves to Supabase. With those unset it runs on this machine's
 * browser storage, which is what local testing uses.
 */
const backend: Backend = hasSupabaseConfig() ? supabaseBackend : localBackend

export const backendName = backend.name

export const newId = (prefix: string): string =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const ensureSeeded = () => backend.ensureSeeded()

export const listProducts = () => backend.listProducts()
export const saveProduct = backend.saveProduct.bind(backend)
export const deleteProduct = (id: string) => backend.deleteProduct(id)

export const listCompanies = () => backend.listCompanies()
export const saveCompany = backend.saveCompany.bind(backend)
export const deleteCompany = (id: string) => backend.deleteCompany(id)

export const listInvoices = () => backend.listInvoices()
export const getInvoice = (id: string) => backend.getInvoice(id)
export const saveInvoice = backend.saveInvoice.bind(backend)
export const deleteInvoice = (id: string) => backend.deleteInvoice(id)

export const getSeller = () => backend.getSeller()
export const saveSeller = backend.saveSeller.bind(backend)
export const resetSeller = () => backend.resetSeller()

export const clearAllData = () => backend.clearAllData()
export const reloadSeedData = () => backend.reloadSeedData()
