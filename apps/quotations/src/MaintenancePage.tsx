import { useEffect, useMemo, useState } from 'react'
import {
  amcStatus,
  daysLeft,
  DUE_WINDOW_DAYS,
  formatDotted,
  needingReminder,
  oneYearOn,
  reminderText,
  STATUS_LABEL,
  type Amc,
  type AmcStatus,
} from '@naveen/shared/amc'
import { DEFAULT_REMINDERS, type ReminderPhone, type ReminderSettings } from '@naveen/shared/reminders'
import type { Company, Product } from '@naveen/shared/types'
import {
  deleteAmc,
  getReminders,
  listAmcs,
  newId,
  saveAmc,
  saveReminders,
} from '@naveen/shared/store'
import { whatsappNumber } from '@naveen/shared/pdf'
import { money } from '@naveen/shared/format'
import { Button, Card, Empty, Field, Input, Modal, Pill, Select } from '@naveen/shared/ui'

/**
 * Annual maintenance.
 *
 * The firm supplies a machine and then services it for a year at a time,
 * renewed like an insurance policy. What this screen is for is the renewal
 * not being missed.
 *
 * The reminder goes to every number on the list in the settings — as many
 * as they care to add, whoever they belong to. It says which company, which
 * machine, and by when.
 *
 * Lapsed contracts sit at the top of the due list, above ones merely
 * expiring soon. A contract that ran out three weeks ago is the urgent one,
 * and sorting it below next month's is how it gets forgotten.
 *
 * Sending is by hand for the moment — a button that opens WhatsApp with the
 * message ready for each of the firm's numbers — because the Meta
 * credentials for automatic sending are not available yet. When they are,
 * the job that sends them reads exactly the same `needingReminder` list and
 * writes back `lastRemindedAt`; nothing on this screen changes.
 */
export default function MaintenancePage({
  companies,
  products,
}: {
  companies: Company[]
  products: Product[]
}) {
  const [list, setList] = useState<Amc[]>([])
  const [reminders, setReminders] = useState<ReminderSettings>(DEFAULT_REMINDERS)
  const [editing, setEditing] = useState<Amc | null>(null)
  const [whoOpen, setWhoOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const reload = async () => {
    setList(await listAmcs())
    setReminders(await getReminders())
    setLoaded(true)
  }
  useEffect(() => {
    void reload()
  }, [])

  const due = useMemo(() => needingReminder(list), [list])
  const rest = useMemo(() => list.filter((a) => !due.some((d) => d.id === a.id)), [list, due])

  const blank = (): Amc => {
    const today = formatDotted(new Date())
    return {
      id: newId('amc'),
      companyId: null,
      companyName: '',
      equipment: '',
      productId: null,
      invoiceNo: '',
      serialNo: '',
      startDate: today,
      endDate: oneYearOn(today),
      amount: null,
      notes: '',
      active: true,
      createdAt: new Date().toISOString(),
    }
  }

  return (
    <div className="anim-rise mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
            Maintenance
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {list.length} contract{list.length === 1 ? '' : 's'} · {due.length} needing attention
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWhoOpen(true)}>
            Reminder numbers{reminders.phones.length ? ` (${reminders.phones.length})` : ''}
          </Button>
          <Button size="sm" onClick={() => setEditing(blank())}>
            Add a contract
          </Button>
        </div>
      </header>

      {reminders.phones.length === 0 && loaded ? (
        <div className="mb-5 rounded-xl2 border border-copper/40 bg-copper-soft/40 px-4 py-3 text-[12.5px] text-ink-2">
          No numbers on the reminder list yet, so there is nowhere for a renewal notice to go.
          Add them under <b>Reminder numbers</b>.
        </div>
      ) : null}

      {!loaded ? null : list.length === 0 ? (
        <Card>
          <Empty
            title="No maintenance contracts yet"
            note="Add one when a machine goes out, and it appears here before the year is up."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
              Needs attention — lapsed, or ending within {DUE_WINDOW_DAYS} days
            </h2>
            {due.length === 0 ? (
              <Card>
                <Empty title="Nothing due" note="Every contract has more than six weeks left." />
              </Card>
            ) : (
              <div className="stagger space-y-3">
                {due.map((a) => (
                  <Row key={a.id} amc={a} phones={reminders.phones} onEdit={() => setEditing(a)} />
                ))}
              </div>
            )}
          </section>

          {rest.length > 0 ? (
            <section>
              <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
                The rest
              </h2>
              <div className="space-y-3">
                {rest.map((a) => (
                  <Row key={a.id} amc={a} phones={reminders.phones} onEdit={() => setEditing(a)} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {editing ? (
        <ContractForm
          amc={editing}
          companies={companies}
          products={products}
          onClose={() => setEditing(null)}
          onDone={async () => {
            setEditing(null)
            await reload()
          }}
        />
      ) : null}

      {whoOpen ? (
        <WhoGetsTold
          settings={reminders}
          onClose={() => setWhoOpen(false)}
          onDone={async () => {
            setWhoOpen(false)
            await reload()
          }}
        />
      ) : null}
    </div>
  )
}

const TONE: Record<AmcStatus, 'sage' | 'copper' | 'clay'> = {
  running: 'sage',
  due: 'copper',
  expired: 'clay',
  stopped: 'sage',
  undated: 'copper',
}

function Row({
  amc,
  phones,
  onEdit,
}: {
  amc: Amc
  phones: ReminderPhone[]
  onEdit: () => void
}) {
  const status = amcStatus(amc)
  const left = daysLeft(amc)
  const needs = status === 'due' || status === 'expired'

  const when =
    left === null
      ? 'no end date'
      : left < 0
        ? `lapsed ${-left} day${left === -1 ? '' : 's'} ago`
        : left === 0
          ? 'ends today'
          : `${left} day${left === 1 ? '' : 's'} left`

  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:border-line-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-6">
        <div className="min-w-[200px] flex-1">
          <div className="text-[14.5px] font-bold text-ink">{amc.companyName || 'Unnamed'}</div>
          <div className="text-[12px] text-muted">
            {amc.equipment || 'No machine named'}
            {amc.serialNo ? ` · ${amc.serialNo}` : ''}
          </div>
        </div>

        <div className="min-w-[128px]">
          <div className="text-[12.5px] text-ink">
            {amc.startDate || '—'} → {amc.endDate || '—'}
          </div>
          <div className="text-[11.5px] text-muted">{when}</div>
        </div>

        <Pill tone={TONE[status]}>{STATUS_LABEL[status]}</Pill>

        {amc.amount !== null ? (
          <div className="text-[13px] font-semibold text-ink">{money(amc.amount)}</div>
        ) : null}

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {needs
            ? phones.map((p) => <TellButton key={p.id} amc={amc} to={p} />)
            : null}
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    </Card>
  )
}

/** Opens WhatsApp with the renewal details ready to send to one of the reminder numbers. */
function TellButton({ amc, to }: { amc: Amc; to: ReminderPhone }) {
  const digits = whatsappNumber(to.phone)
  const text = reminderText(amc)
  const href = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`Tell ${to.name || to.phone}`}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line-2 bg-card px-3 text-[12.5px] font-semibold text-ink transition-colors hover:border-copper hover:text-copper"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M20.5 11.5a8.5 8.5 0 01-12.6 7.4L3.5 20.5l1.7-4.3A8.5 8.5 0 1120.5 11.5z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {to.name || 'Tell'}
    </a>
  )
}

function WhoGetsTold({
  settings,
  onClose,
  onDone,
}: {
  settings: ReminderSettings
  onClose: () => void
  onDone: () => void
}) {
  const [s, setS] = useState<ReminderSettings>(settings)

  const add = () =>
    setS((x) => ({ ...x, phones: [...x.phones, { id: newId('r'), name: '', phone: '' }] }))
  const patch = (id: string, p: Partial<ReminderPhone>) =>
    setS((x) => ({ ...x, phones: x.phones.map((q) => (q.id === id ? { ...q, ...p } : q)) }))
  const remove = (id: string) =>
    setS((x) => ({ ...x, phones: x.phones.filter((q) => q.id !== id) }))

  return (
    <Modal
      open
      onClose={onClose}
      title="Reminder numbers"
      subtitle="Every number here gets the renewal reminder. Add as many as you like."
      width="max-w-xl"
    >
      <div className="space-y-4">
        <Field label="Start reminding" hint="Days before the end date. It then repeats daily.">
          <Input
            value={String(s.startDays)}
            onChange={(e) => setS({ ...s, startDays: Number(e.target.value) || 0 })}
          />
        </Field>

        <div className="rounded-xl2 border border-line bg-bone/50 px-4 py-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-ink">Numbers</span>
            <Button variant="outline" size="sm" onClick={add}>
              + Add a number
            </Button>
          </div>

          {s.phones.length === 0 ? (
            <p className="text-[12px] text-muted">
              None yet. Add whoever should know a renewal is coming up.
            </p>
          ) : (
            <div className="space-y-2">
              {s.phones.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      value={p.name}
                      placeholder="Name"
                      onChange={(e) => patch(p.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Input
                      value={p.phone}
                      placeholder="WhatsApp number"
                      onChange={(e) => patch(p.id, { phone: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={() => remove(p.id)}
                    aria-label="Remove number"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-clay/12 hover:text-clay"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              await saveReminders(s)
              onDone()
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ContractForm({
  amc,
  companies,
  products,
  onClose,
  onDone,
}: {
  amc: Amc
  companies: Company[]
  products: Product[]
  onClose: () => void
  onDone: () => void
}) {
  const [a, setA] = useState<Amc>(amc)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof Amc>(k: K, v: Amc[K]) => setA((x) => ({ ...x, [k]: v }))

  /* The year runs from the start date, so moving it moves the end with it —
     unless the end has been typed over by hand, which wins. */
  const setStart = (startDate: string) =>
    setA((x) => ({
      ...x,
      startDate,
      endDate: x.endDate === oneYearOn(x.startDate) ? oneYearOn(startDate) : x.endDate,
    }))

  return (
    <Modal open onClose={onClose} title="Maintenance contract" width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Company" className="sm:col-span-2">
            <Select
              value={a.companyId ?? ''}
              onChange={(e) => {
                const c = companies.find((x) => x.id === e.target.value) ?? null
                setA((x) => ({
                  ...x,
                  companyId: c?.id ?? null,
                  companyName: c?.name ?? x.companyName,
                }))
              }}
            >
              <option value="">Select a company…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Machine from the catalogue" className="sm:col-span-2">
            <Select
              value={a.productId ?? ''}
              onChange={(e) => {
                const p = products.find((x) => x.id === e.target.value) ?? null
                setA((x) => ({
                  ...x,
                  productId: p?.id ?? null,
                  equipment: p?.name ?? x.equipment,
                }))
              }}
            >
              <option value="">Pick one, or just type it below…</option>
              {products
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Machine, as it should read" className="sm:col-span-2">
            <Input value={a.equipment} onChange={(e) => set('equipment', e.target.value)} />
          </Field>

          <Field label="Serial / machine no">
            <Input value={a.serialNo} onChange={(e) => set('serialNo', e.target.value)} />
          </Field>

          <Field label="Sold on bill no" hint="So the sale can be found later.">
            <Input value={a.invoiceNo} onChange={(e) => set('invoiceNo', e.target.value)} />
          </Field>

          <Field label="Start date" hint="dd.mm.yyyy">
            <Input value={a.startDate} onChange={(e) => setStart(e.target.value)} />
          </Field>

          <Field label="Ends" hint="A year on, unless you change it.">
            <Input value={a.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>

          <Field label="Amount" hint="Leave blank if it is settled with the customer.">
            <Input
              value={a.amount === null ? '' : String(a.amount)}
              onChange={(e) =>
                set('amount', e.target.value.trim() === '' ? null : Number(e.target.value) || 0)
              }
            />
          </Field>

          <Field label="Still running">
            <Select
              value={a.active ? 'yes' : 'no'}
              onChange={(e) => set('active', e.target.value === 'yes')}
            >
              <option value="yes">Yes — remind before it lapses</option>
              <option value="no">No — stop reminding</option>
            </Select>
          </Field>

          <Field label="Notes" className="sm:col-span-2">
            <Input value={a.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          {confirmDelete ? (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await deleteAmc(a.id)
                  onDone()
                }}
              >
                Yes, delete it
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="mr-auto text-[12.5px] font-semibold text-muted hover:text-clay"
            >
              Delete
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              await saveAmc(a)
              onDone()
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}
