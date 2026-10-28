import { useMemo, useState } from 'react'
import type { Product } from '../lib/types'
import { money } from '../lib/format'
import { deleteProduct, saveProduct } from '../lib/store'
import ProductForm from '../components/ProductForm'
import { Button, Card, Empty, Input, Modal, Pill } from '../components/ui'

export default function ProductsPage({
  products,
  onChanged,
}: {
  products: Product[]
  onChanged: () => void
}) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return products
    return products.filter(
      (p) => p.name.toLowerCase().includes(s) || p.hsn.toLowerCase().includes(s),
    )
  }, [products, q])

  const close = () => {
    setEditing(null)
    setAdding(false)
  }

  return (
    <div className="anim-rise">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
            Products
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {products.length} item{products.length === 1 ? '' : 's'} in the catalogue — rate and GST
            carry straight onto the bill.
          </p>
        </div>
        <div className="flex w-full items-center gap-2.5 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
          </div>
          <Button className="shrink-0" onClick={() => setAdding(true)}>
            + Add
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <Empty title="Nothing here" note="Add a product and it shows up on the billing screen." />
        ) : (
          <>
            {/* phone: cards instead of a six-column table */}
            <div className="divide-y divide-line/60 lg:hidden">
              {list.map((p) => (
                <div key={p.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold leading-snug text-ink">{p.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
                        <span className="font-mono">{p.hsn}</span>
                        <span>{p.kind === 'service' ? 'Service' : `${p.unit} / ${p.per}`}</span>
                        <span>GST {p.gstRate}%</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-display text-[16px] font-semibold text-ink">
                      {money(p.rate)}
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                    {confirmId === p.id ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          await deleteProduct(p.id)
                          setConfirmId(null)
                          onChanged()
                        }}
                      >
                        Confirm
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmId(p.id)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <table className="hidden w-full text-[13.5px] lg:table">
            <thead>
              <tr className="border-b border-line text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
                <th className="py-3 pl-6 text-left">Item</th>
                <th className="w-28 py-3 text-left">HSN/SAC</th>
                <th className="w-28 py-3 text-left">Unit</th>
                <th className="w-24 py-3 text-right">GST</th>
                <th className="w-32 py-3 text-right">Rate</th>
                <th className="w-40 py-3 pr-6" />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr
                  key={p.id}
                  className="group border-b border-line/60 transition-colors last:border-0 hover:bg-bone/70"
                >
                  <td className="py-3 pl-6">
                    <span className="font-bold text-ink">{p.name}</span>
                    {p.kind === 'service' ? (
                      <span className="ml-2 align-middle">
                        <Pill tone="copper">Service</Pill>
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 font-mono text-[12.5px] text-ink-2">{p.hsn}</td>
                  <td className="py-3 text-ink-2">
                    {p.kind === 'service' ? '—' : `${p.unit} / ${p.per}`}
                  </td>
                  <td className="py-3 text-right tabular-nums text-ink-2">{p.gstRate}%</td>
                  <td className="py-3 text-right font-bold tabular-nums text-ink">
                    {money(p.rate)}
                  </td>
                  <td className="py-3 pr-6">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                      {confirmId === p.id ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={async () => {
                            await deleteProduct(p.id)
                            setConfirmId(null)
                            onChanged()
                          }}
                        >
                          Confirm
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setConfirmId(p.id)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </>
        )}
      </Card>

      <Modal
        open={adding || !!editing}
        onClose={close}
        title={editing ? 'Edit product' : 'Add product'}
        subtitle="HSN and GST rate decide how the tax summary groups on the printed bill."
      >
        <ProductForm
          initial={editing ?? undefined}
          onCancel={close}
          onSave={async (p) => {
            await saveProduct(p)
            close()
            onChanged()
          }}
        />
      </Modal>
    </div>
  )
}
