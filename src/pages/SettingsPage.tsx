import { useEffect, useState } from 'react'
import type { Company, Seller } from '../lib/types'
import {
  clearAllData,
  reloadSeedData,
  resetSeller,
  saveCompany,
  saveSeller,
} from '../lib/store'
import CompanyForm from '../components/CompanyForm'
import { Button, Card, CardHead, Field, Input, Modal, Pill, TextArea } from '../components/ui'

export default function SettingsPage({
  seller,
  companies,
  counts,
  onSellerChanged,
  onCompaniesChanged,
  onChanged,
}: {
  seller: Seller
  companies: Company[]
  counts: { products: number; companies: number; invoices: number }
  onSellerChanged: (s: Seller) => void
  onCompaniesChanged: () => void
  onChanged: () => void
}) {
  const [confirmClear, setConfirmClear] = useState(false)
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState<Company | null>(null)
  const [adding, setAdding] = useState(false)

  const say = (t: string) => {
    setNote(t)
    window.setTimeout(() => setNote(''), 3000)
  }

  const closeCompany = () => {
    setEditing(null)
    setAdding(false)
  }

  return (
    <div className="anim-rise max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
          Settings
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          Your own details, the companies you sell to, and the demo data.
        </p>
      </header>

      {note ? (
        <div className="anim-rise mb-5 rounded-xl2 bg-sage/12 px-4 py-3 text-[13.5px] font-semibold text-sage">
          {note}
        </div>
      ) : null}

      <div className="space-y-5">
        <SellerCard
          seller={seller}
          onSave={async (s) => {
            await saveSeller(s)
            onSellerChanged(s)
            say('Your firm details were updated.')
          }}
          onReset={async () => {
            const s = await resetSeller()
            onSellerChanged(s)
            say('Firm details put back to the original bill.')
          }}
        />

        <Card>
          <CardHead
            title="Companies you bill"
            subtitle="Address and GSTIN print under Consignee; the state decides CGST+SGST or IGST."
            right={
              <Button size="sm" onClick={() => setAdding(true)}>
                + Add company
              </Button>
            }
          />
          {companies.length === 0 ? (
            <p className="px-6 py-10 text-center text-[13.5px] text-muted">
              No companies yet — add the first one.
            </p>
          ) : (
            <div className="scroll-thin max-h-[340px] overflow-y-auto">
              {companies.map((c) => (
                <div
                  key={c.id}
                  className="group flex items-center gap-4 border-b border-line/60 px-6 py-3 transition-colors last:border-0 hover:bg-bone/70"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold text-ink">{c.name}</div>
                    <div className="truncate text-[12px] text-muted">
                      {c.addressLines[c.addressLines.length - 1] ?? ''}
                      <span className="ml-2 font-mono">{c.gstin}</span>
                    </div>
                  </div>
                  {c.state.trim().toLowerCase() === seller.state.trim().toLowerCase() ? (
                    <Pill tone="sage">CGST+SGST</Pill>
                  ) : (
                    <Pill tone="copper">IGST</Pill>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="Data" subtitle="Everything is stored on this machine for now." />
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-3">
            <Stat label="Products" value={counts.products} />
            <Stat label="Companies" value={counts.companies} />
            <Stat label="Invoices" value={counts.invoices} />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-6 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await reloadSeedData()
                onChanged()
                say('Demo catalogue restored.')
              }}
            >
              Restore demo catalogue
            </Button>
            {confirmClear ? (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    await clearAllData()
                    setConfirmClear(false)
                    onChanged()
                    say('All data cleared. Start fresh with your own products.')
                  }}
                >
                  Yes, wipe everything
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
                Clear all seed data
              </Button>
            )}
            <span className="text-[12px] text-muted">
              Clearing removes the demo products, companies and saved bills.
            </span>
          </div>
        </Card>
      </div>

      <Modal
        open={adding || !!editing}
        onClose={closeCompany}
        title={editing ? 'Edit company' : 'Add a company'}
        subtitle="Name, address and GSTIN print under Consignee on the bill."
      >
        <CompanyForm
          initial={editing ?? undefined}
          homeState={seller.state}
          onCancel={closeCompany}
          onSave={async (c) => {
            await saveCompany(c)
            closeCompany()
            onCompaniesChanged()
            say(`${c.name} saved.`)
          }}
        />
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------- firm */

function SellerCard({
  seller,
  onSave,
  onReset,
}: {
  seller: Seller
  onSave: (s: Seller) => void
  onReset: () => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Seller>(seller)
  const [address, setAddress] = useState(seller.addressLines.join('\n'))
  const [declaration, setDeclaration] = useState(seller.declaration.join('\n'))

  useEffect(() => {
    setForm(seller)
    setAddress(seller.addressLines.join('\n'))
    setDeclaration(seller.declaration.join('\n'))
  }, [seller])

  const set = <K extends keyof Seller>(k: K, v: Seller[K]) => setForm((p) => ({ ...p, [k]: v }))

  const lines = (s: string) =>
    s
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

  return (
    <Card>
      <CardHead
        title="Your firm"
        subtitle="Printed at the top of every bill, word for word."
        right={
          <div className="flex items-center gap-2">
            {open ? (
              <Button variant="ghost" size="sm" onClick={onReset}>
                Reset
              </Button>
            ) : null}
            <Button variant={open ? 'outline' : 'primary'} size="sm" onClick={() => setOpen(!open)}>
              {open ? 'Close' : 'Edit'}
            </Button>
          </div>
        }
      />

      {!open ? (
        <div className="grid gap-6 px-6 py-5 sm:grid-cols-2">
          <div className="rounded-xl2 border border-line bg-bone px-5 py-4 text-[13px] leading-relaxed text-ink-2">
            <div className="mb-1 font-display text-[18px] font-semibold text-ink">{seller.name}</div>
            {seller.addressLines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            <div>{seller.cell}</div>
            <div>{seller.email}</div>
            <div className="mt-1 font-mono text-[12.5px]">{seller.gstin}</div>
          </div>
          <div className="space-y-3 text-[13px] text-ink-2">
            <Info label="Home state" value={`${seller.state} — buyers here get CGST + SGST`} />
            <Info label="Outside the state" value="Puducherry and the rest get IGST" />
            <Info label="Bank" value={seller.bankLine.replace('Bank Details : ', '')} />
          </div>
        </div>
      ) : (
        <div className="anim-fade space-y-4 px-6 py-5">
          <Field label="Firm name">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>

          <Field label="Address" hint="One line per row, printed exactly like this.">
            <TextArea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone line" hint="Printed as-is, including the “Cell :” prefix.">
              <Input value={form.cell} onChange={(e) => set('cell', e.target.value)} />
            </Field>
            <Field label="Email line" hint="Printed as-is, including the “Email :” prefix.">
              <Input value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="GSTIN line">
              <Input
                value={form.gstin}
                onChange={(e) => set('gstin', e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Home state" hint="Buyers in this state get CGST + SGST.">
              <Input value={form.state} onChange={(e) => set('state', e.target.value)} />
            </Field>
          </div>

          <Field label="Bank details line">
            <Input value={form.bankLine} onChange={(e) => set('bankLine', e.target.value)} />
          </Field>

          <Field label="Declaration" hint="One line per row, printed in the bottom-left box.">
            <TextArea
              rows={2}
              value={declaration}
              onChange={(e) => setDeclaration(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2.5 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave({
                  ...form,
                  addressLines: lines(address),
                  declaration: lines(declaration),
                })
                setOpen(false)
              }}
            >
              Save firm details
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted">{label}</div>
      <div className="mt-0.5 leading-snug">{value}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl2 border border-line bg-bone px-5 py-4">
      <div className="font-display text-[26px] font-semibold leading-none text-ink">{value}</div>
      <div className="mt-1 text-[11.5px] font-bold uppercase tracking-[0.09em] text-muted">
        {label}
      </div>
    </div>
  )
}
