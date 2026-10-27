import { useState } from 'react'
import type { Company } from '../lib/types'
import { INDIAN_STATES, HOME_STATE } from '../lib/seller'
import { newId } from '../lib/store'
import { Button, Field, Input, Select, TextArea, Pill } from './ui'

const blank = (): Company => ({
  id: '',
  name: '',
  addressLines: [],
  gstin: '',
  state: HOME_STATE,
  phone: '',
  email: '',
  active: true,
})

export default function CompanyForm({
  initial,
  homeState = HOME_STATE,
  onSave,
  onCancel,
}: {
  initial?: Company
  homeState?: string
  onSave: (c: Company) => void
  onCancel: () => void
}) {
  const [c, setC] = useState<Company>(initial ?? { ...blank(), state: homeState })
  const [address, setAddress] = useState((initial?.addressLines ?? []).join('\n'))
  const [error, setError] = useState('')

  const set = <K extends keyof Company>(k: K, v: Company[K]) => setC((p) => ({ ...p, [k]: v }))

  const submit = () => {
    if (!c.name.trim()) return setError('Company name is required.')
    if (!address.trim()) return setError('Address is required — it is printed on the bill.')
    onSave({
      ...c,
      id: c.id || newId('c'),
      name: c.name.trim(),
      gstin: c.gstin.trim().toUpperCase(),
      addressLines: address
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    })
  }

  const interState = c.state.trim().toLowerCase() !== homeState.trim().toLowerCase()

  return (
    <div className="space-y-4">
      <Field label="Company name">
        <Input
          autoFocus
          value={c.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Primetec Industries"
        />
      </Field>

      <Field label="Address" hint="One line per row — printed exactly like this under Consignee.">
        <TextArea
          rows={3}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={'No.164/39, Tiny Sector.\nSIDCO Industrial Estate, (Nr. Korattur),\nChennai - 600098.'}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="GSTIN">
          <Input
            value={c.gstin}
            onChange={(e) => set('gstin', e.target.value.toUpperCase())}
            placeholder="33AFRPV0173R1ZL"
            className="font-mono tracking-tight"
          />
        </Field>
        <Field label="State">
          <Select value={c.state} onChange={(e) => set('state', e.target.value)}>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl2 border border-line bg-bone px-4 py-3">
        {interState ? <Pill tone="copper">IGST</Pill> : <Pill tone="sage">CGST + SGST</Pill>}
        <span className="text-[12.5px] text-ink-2">
          {interState
            ? `${c.state} is outside ${homeState} — bills will carry IGST.`
            : `Within ${homeState} — bills will carry CGST and SGST.`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone">
          <Input
            value={c.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="044 2625 4411"
          />
        </Field>
        <Field label="Email">
          <Input
            value={c.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            placeholder="accounts@company.in"
          />
        </Field>
      </div>

      {error ? (
        <p className="anim-fade rounded-xl2 bg-clay/10 px-4 py-2.5 text-[13px] font-medium text-clay">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2.5 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit}>{initial ? 'Save changes' : 'Add company'}</Button>
      </div>
    </div>
  )
}
