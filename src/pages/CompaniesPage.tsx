import { useMemo, useState } from 'react'
import type { Company } from '../lib/types'
import { deleteCompany, saveCompany } from '../lib/store'
import CompanyForm from '../components/CompanyForm'
import { Button, Card, Empty, Input, Modal, Pill } from '../components/ui'

export default function CompaniesPage({
  companies,
  homeState,
  onChanged,
}: {
  companies: Company[]
  homeState: string
  onChanged: () => void
}) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Company | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return companies
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.gstin.toLowerCase().includes(s) ||
        c.state.toLowerCase().includes(s),
    )
  }, [companies, q])

  const close = () => {
    setEditing(null)
    setAdding(false)
  }

  return (
    <div className="anim-rise">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
            Companies
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {companies.length} buyer{companies.length === 1 ? '' : 's'} — their state decides CGST+SGST
            or IGST.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-64">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
          </div>
          <Button onClick={() => setAdding(true)}>+ Add company</Button>
        </div>
      </header>

      {list.length === 0 ? (
        <Card>
          <Empty title="No companies yet" note="Add the firms you sell to and bill them in a tap." />
        </Card>
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((c) => (
            <Card
              key={c.id}
              className="group flex flex-col transition-all duration-200 ease-out hover:-translate-y-1 hover:border-line-2 hover:shadow-[0_22px_40px_-26px_rgba(42,32,24,0.6)]"
            >
              <div className="flex-1 px-5 py-5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="font-display text-[17px] font-semibold leading-snug text-ink">
                    {c.name}
                  </h3>
                  {c.state.trim().toLowerCase() === homeState.trim().toLowerCase() ? (
                    <Pill tone="sage">CGST+SGST</Pill>
                  ) : (
                    <Pill tone="copper">IGST</Pill>
                  )}
                </div>
                <div className="space-y-0.5 text-[12.5px] leading-relaxed text-ink-2">
                  {c.addressLines.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
                <div className="mt-3 font-mono text-[12px] text-muted">{c.gstin}</div>
                {c.phone || c.email ? (
                  <div className="mt-1 text-[12px] text-muted">
                    {[c.phone, c.email].filter(Boolean).join(' · ')}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {c.state}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                    Edit
                  </Button>
                  {confirmId === c.id ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={async () => {
                        await deleteCompany(c.id)
                        setConfirmId(null)
                        onChanged()
                      }}
                    >
                      Confirm
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(c.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={adding || !!editing}
        onClose={close}
        title={editing ? 'Edit company' : 'Add a company'}
        subtitle="Name, address and GSTIN print under Consignee on the bill."
      >
        <CompanyForm
          initial={editing ?? undefined}
          homeState={homeState}
          onCancel={close}
          onSave={async (c) => {
            await saveCompany(c)
            close()
            onChanged()
          }}
        />
      </Modal>
    </div>
  )
}
