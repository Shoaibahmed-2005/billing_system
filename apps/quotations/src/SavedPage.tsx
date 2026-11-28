import { useMemo, useState } from 'react'
import type { Quotation } from '@naveen/shared/quote'
import { money } from '@naveen/shared/format'
import { Button, Card, Empty, Input } from '@naveen/shared/ui'

/**
 * Every quotation that has been saved, newest first.
 *
 * A quotation is not a bill: there is no ledger to balance and no number
 * that must run unbroken, so this is a drawer rather than a register. What
 * it has to do well is find the one you sent in March and open it again,
 * because the usual reason to look is that the customer has come back.
 *
 * Opening one loads it into the desk as it was saved — the buyer as they
 * were addressed, the prices as they were quoted, the terms as they were
 * typed. Saving again overwrites that same quotation rather than making a
 * second copy, which is what someone correcting a typo expects. To quote the
 * same customer again at a new price, start a new one.
 */
export default function SavedPage({
  quotations,
  onOpen,
  onDelete,
  onNew,
}: {
  quotations: Quotation[]
  onOpen: (q: Quotation) => void
  onDelete: (q: Quotation) => void
  onNew: () => void
}) {
  const [q, setQ] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return quotations
    return quotations.filter((x) =>
      `${x.buyer.name} ${x.meta.slNo} ${x.meta.dated} ${x.meta.ref} ${x.items
        .map((i) => i.description)
        .join(' ')}`
        .toLowerCase()
        .includes(t),
    )
  }, [quotations, q])

  return (
    <div className="anim-rise mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
            Saved quotations
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {quotations.length === 1 ? '1 quotation' : `${quotations.length} quotations`} · open one
            to print it again or change it
          </p>
        </div>
        <Button size="sm" onClick={onNew}>
          New quotation
        </Button>
      </header>

      {quotations.length > 3 ? (
        <div className="mb-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by company, number or part…"
          />
        </div>
      ) : null}

      {!quotations.length ? (
        <Card>
          <Empty
            title="Nothing saved yet"
            note="Build a quotation and press Save, and it will be here afterwards."
          />
        </Card>
      ) : !shown.length ? (
        <Card>
          <Empty title="Nothing matches that" note="Try the company name or the number." />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {shown.map((x) => (
            <Card key={x.id}>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-ink">{x.buyer.name}</span>
                    <span className="rounded-full bg-bone-2 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                      {x.meta.template === 'machine' ? 'Machine' : 'Spares'}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted">
                    {x.meta.slNo ? `No ${x.meta.slNo} · ` : ''}
                    {x.meta.dated}
                    {x.items.length ? ` · ${x.items.length} line${x.items.length > 1 ? 's' : ''}` : ''}
                    {x.total ? ` · ${money(x.total)}` : ''}
                    {x.meta.template === 'machine' && x.total ? ' + GST' : ''}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {confirming === x.id ? (
                    <>
                      <span className="text-[12px] text-muted">Delete it?</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setConfirming(null)
                          onDelete(x)
                        }}
                      >
                        Yes
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                        No
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => onOpen(x)}>
                        Open
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(x.id)}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
