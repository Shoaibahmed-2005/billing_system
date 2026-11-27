import { useEffect, useRef, useState } from 'react'
import type { Company, Seller } from '@naveen/shared/types'
import {
  backendName,
  clearAllData,
  clearForHandover,
  countDemoRows,
  reloadSeedData,
  resetSeller,
  saveCompany,
  saveSeller,
} from '@naveen/shared/store'
import { SELLER } from '@naveen/shared/seller'
import { prepareSignature } from '@naveen/shared/signature'
import BackupCard from '@naveen/shared/BackupCard'
import CompanyForm from '../components/CompanyForm'
import { Button, Card, CardHead, Field, Input, Modal, Pill, TextArea } from '@naveen/shared/ui'

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
                  className="group flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line/60 px-4 py-3 transition-colors last:border-0 hover:bg-bone/70 sm:px-6"
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

        <BackupCard onChanged={onChanged} />

        <HandoverCard counts={counts} onChanged={onChanged} say={say} />

        <Card>
          <CardHead
            title="Data"
            subtitle={
              backendName === 'supabase'
                ? 'Kept in the shop database — the same bills on every device.'
                : 'Kept in this browser on this machine.'
            }
          />
          <div className="grid gap-4 px-4 py-5 sm:grid-cols-3 sm:px-6">
            <Stat label="Products" value={counts.products} />
            <Stat label="Companies" value={counts.companies} />
            <Stat label="Invoices" value={counts.invoices} />
          </div>
          {/*
            The demo buttons are for developing against browser storage. On
            the shop's own database there is no version of "restore the demo
            catalogue" that is anything but a way to drop fifty-seven parts
            nobody sells into a live price list.
          */}
          {backendName === 'local' ? (
          <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-4 py-4 sm:px-6">
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
              Developer buttons, browser storage only. Clearing removes the demo products,
              companies and saved bills.
            </span>
          </div>
          ) : null}
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
            <SignatureBox seller={seller} onSave={onSave} />
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

/* -------------------------------------------------------------- signature */

/**
 * The signature printed above "Authorised Signatory". Uploading one strips its
 * white background first, so a photo of a signature on paper still drops
 * cleanly onto the ruled line.
 */
function SignatureBox({ seller, onSave }: { seller: Seller; onSave: (s: Seller) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    setError('')
    try {
      const { dataUrl } = await prepareSignature(f)
      onSave({ ...seller, signature: dataUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that image.')
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }

  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted">
        Signature
      </div>

      <div className="mt-1.5 flex items-center gap-3">
        <div className="grid h-[52px] w-[120px] shrink-0 place-items-center rounded-xl2 border border-line bg-card px-2">
          {seller.signature ? (
            <img src={seller.signature} alt="Signature" className="max-h-10 max-w-full object-contain" />
          ) : (
            <span className="text-[11px] text-muted">None</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => file.current?.click()}>
            {busy ? 'Reading…' : seller.signature ? 'Replace' : 'Upload'}
          </Button>
          {seller.signature ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSave({ ...seller, signature: '' })}
            >
              Remove
            </Button>
          ) : SELLER.signature ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSave({ ...seller, signature: SELLER.signature })}
            >
              Use the original
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {error ? (
        <p className="mt-1.5 text-[11.5px] font-medium text-clay">{error}</p>
      ) : (
        <p className="mt-1.5 text-[11.5px] leading-snug text-muted">
          Printed above "Authorised Signatory". Each bill can also leave it off, to be signed by
          hand.
        </p>
      )}
    </div>
  )
}

/**
 * The one-time handover panel.
 *
 * The site ships with a demo catalogue so there is something to click while
 * it is being built. Before the shop starts billing for real that has to go,
 * and this is the button that does it: the fifty-seven demo parts and six
 * demo companies deleted by their own ids, and the bills raised while
 * testing deleted with them.
 *
 * Two things make it safe. It deletes rows by id from the shipped list, so
 * anything the shop has entered cannot be caught by it whatever it is
 * called. And once the demo rows are gone the panel is not rendered again —
 * there is nothing left for it to do, so nobody at the counter can press it
 * by accident a year from now with a real catalogue in place.
 */
function HandoverCard({
  counts,
  onChanged,
  say,
}: {
  counts: { products: number; companies: number; invoices: number }
  onChanged: () => void
  say: (t: string) => void
}) {
  const [demo, setDemo] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    void countDemoRows()
      .then((n) => live && setDemo(n))
      .catch(() => live && setDemo(0))
    return () => {
      live = false
    }
  }, [counts.products, counts.companies])

  if (demo === null || demo === 0) return null

  return (
    <Card className="border-copper/40">
      <CardHead
        title="Before the shop starts billing"
        subtitle="Clear the demo catalogue and the bills raised while testing."
      />
      <div className="px-4 py-4 sm:px-6">
        <p className="text-[13px] leading-relaxed text-ink-2">
          {demo} demo row{demo === 1 ? '' : 's'} are still here, and{' '}
          {counts.invoices === 0 ? 'no bills have been saved' : `${counts.invoices} saved bill${
            counts.invoices === 1 ? '' : 's'
          }`}
          . Removing them leaves an empty catalogue to fill with your own parts and companies.
          Your firm details and signature stay as they are.
        </p>

        {confirm ? (
          <div className="mt-4 rounded-xl2 border border-clay/30 bg-clay/8 px-4 py-3.5">
            <p className="text-[13px] font-semibold text-ink">
              Delete the {demo} demo row{demo === 1 ? '' : 's'}
              {counts.invoices === 0
                ? ''
                : counts.invoices === 1
                  ? ' and the one saved bill'
                  : ` and all ${counts.invoices} saved bills`}
              ? This cannot be undone.
            </p>
            <p className="mt-1 text-[12px] text-muted">
              Take a backup first if you want to keep a copy of the test bills.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                className="w-full sm:w-auto"
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await clearForHandover()
                    setConfirm(false)
                    setDemo(0)
                    onChanged()
                    say('Demo data removed. The catalogue is yours to fill.')
                  } catch {
                    say('Could not remove the demo data. Try again.')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? 'Removing…' : 'Yes, remove it'}
              </Button>
              <Button
                className="w-full sm:w-auto"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="mt-3.5 w-full sm:w-auto"
            variant="outline"
            size="sm"
            onClick={() => setConfirm(true)}
          >
            Remove the demo data
          </Button>
        )}
      </div>
    </Card>
  )
}
