import { useState, type FormEvent } from 'react'
import { signIn } from '../lib/auth'
import { SELLER } from '../lib/seller'
import { Button, Field, Input } from './ui'

/**
 * The counter's front door. One shop account, created in the Supabase
 * dashboard — there is deliberately no sign-up here.
 */
export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!email.trim() || !password) {
      setError('Enter the email and password.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await signIn(email, password)
      // The auth listener in App swaps this screen for the counter.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* brand panel — hidden on small screens */}
      <aside className="hidden w-[44%] max-w-[520px] flex-col justify-between bg-espresso px-12 py-12 lg:flex">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-copper font-display text-[18px] font-bold text-espresso">
            NA
          </div>
          <div className="leading-tight">
            <div className="font-display text-[19px] font-semibold tracking-tight text-bone">
              {SELLER.name}
            </div>
            <div className="text-[11.5px] tracking-wide text-bone/45">Billing Counter</div>
          </div>
        </div>

        <div className="anim-slide">
          <h1 className="font-display text-[34px] font-semibold leading-[1.15] text-bone">
            Bills, parts and
            <br />
            buyers in one place.
          </h1>
          <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-bone/50">
            Tap the parts, settle the price, print the bill. GST works itself out — CGST and SGST
            within Tamil Nadu, IGST everywhere else.
          </p>
        </div>

        <div className="text-[11.5px] leading-relaxed text-bone/35">
          Chengalpattu · Tamil Nadu
          <br />
          {SELLER.gstin.replace('GSTIN: ', 'GSTIN ')}
        </div>
      </aside>

      {/* form */}
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <form onSubmit={submit} className="anim-rise w-full max-w-[380px]">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-copper font-display text-[18px] font-bold text-espresso">
              NA
            </div>
            <div className="font-display text-[20px] font-semibold text-ink">{SELLER.name}</div>
          </div>

          <h2 className="font-display text-[26px] font-semibold leading-tight text-ink">
            Sign in
          </h2>
          <p className="mb-7 mt-1.5 text-[13px] text-muted">
            Use the shop account to open the counter.
          </p>

          <div className="space-y-4">
            <Field label="Email">
              <Input
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="shop@naveenairtech.in"
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </div>

          {error ? (
            <p
              role="alert"
              className="anim-fade mt-4 rounded-xl2 bg-clay/10 px-4 py-2.5 text-[13px] font-medium text-clay"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>

          <p className="mt-6 text-[12px] leading-relaxed text-muted">
            Accounts are created in the Supabase dashboard under{' '}
            <b className="font-semibold text-ink-2">Authentication → Users</b>. Forgotten passwords
            are reset there too.
          </p>
        </form>
      </main>
    </div>
  )
}
