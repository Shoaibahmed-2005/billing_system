import { useEffect, useState } from 'react'
import { authEnabled, currentAccount, onAuthChange, signOut, type Account } from '@naveen/shared/auth'
import { ensureSeeded, listCompanies, listProducts } from '@naveen/shared/store'
import { SELLER } from '@naveen/shared/seller'
import SignIn from '@naveen/shared/SignIn'
import { Button, Card, CardHead, Empty } from '@naveen/shared/ui'

/**
 * The quotations desk — the second site, sharing the billing counter's
 * database.
 *
 * This much is the frame: the same sign-in, the same firm, and the same
 * companies and products, read through the same store. Nothing here is
 * copied from the billing site; both import one set of modules out of
 * packages/shared, so a change to the catalogue or the firm's details is a
 * change to both at once.
 *
 * The quotation itself is not built yet. The client has two different
 * printed layouts in circulation — one that totals with GST, one that says
 * "GST 18% Extra" and gives no total — and which of them to reproduce is
 * still being settled.
 */
export default function App() {
  const [checked, setChecked] = useState(!authEnabled)
  const [account, setAccount] = useState<Account | null>(null)
  const [counts, setCounts] = useState<{ companies: number; products: number } | null>(null)

  useEffect(() => {
    if (!authEnabled) return
    void currentAccount().then((a) => {
      setAccount(a)
      setChecked(true)
    })
    return onAuthChange(setAccount)
  }, [])

  const signedIn = !authEnabled || account !== null

  useEffect(() => {
    if (!signedIn) return
    void (async () => {
      await ensureSeeded()
      setCounts({
        companies: (await listCompanies()).length,
        products: (await listProducts()).length,
      })
    })()
  }, [signedIn])

  if (!checked) {
    return (
      <div className="grid min-h-full place-items-center text-[13px] text-muted">
        Checking the session…
      </div>
    )
  }

  if (!signedIn) return <SignIn />

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="anim-rise mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink">
            Quotations
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {SELLER.name} · sharing the billing counter's data
          </p>
        </div>
        {authEnabled ? (
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        ) : null}
      </header>

      <div className="anim-rise space-y-5">
        <Card>
          <CardHead
            title="Same database"
            subtitle="Read live from the tables the billing site writes to."
          />
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <Stat label="Companies" value={counts?.companies} />
            <Stat label="Products" value={counts?.products} />
          </div>
        </Card>

        <Card>
          <Empty
            title="Quotations are not built yet"
            note="Waiting on which of the two printed layouts to reproduce — the spares one totals with GST, the machine one says GST 18% Extra and gives no total."
          />
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl2 border border-line bg-bone/50 px-4 py-3.5">
      <div className="font-display text-[26px] font-semibold leading-none text-ink">
        {value ?? '—'}
      </div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
        {label}
      </div>
    </div>
  )
}
