import { useState } from 'react'
import type { Product } from '../lib/types'
import { newId } from '../lib/store'
import { Button, Field, Input, Select } from './ui'

const UNITS = ['No', 'Nos', 'Set', 'Ltrs', 'Kg', 'Mtr', 'Pair', 'Box']
const PERS = ['Each', 'Set', 'Ltr', 'Kg', 'Mtr', 'Box']
const GST_SLABS = [0, 5, 12, 18, 28]

const blank = (): Product => ({
  id: '',
  name: '',
  hsn: '',
  unit: 'No',
  per: 'Each',
  rate: 0,
  gstRate: 18,
  kind: 'goods',
  active: true,
})

export default function ProductForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Product
  onSave: (p: Product) => void
  onCancel: () => void
}) {
  const [p, setP] = useState<Product>(initial ?? blank())
  const [error, setError] = useState('')
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((s) => ({ ...s, [k]: v }))

  const submit = () => {
    if (!p.name.trim()) return setError('Product name is required.')
    if (!p.hsn.trim()) return setError('HSN / SAC code is required — the GST summary groups by it.')
    onSave({
      ...p,
      id: p.id || newId(p.kind === 'service' ? 's' : 'p'),
      name: p.name.trim(),
      hsn: p.hsn.trim(),
      rate: Number(p.rate) || 0,
      unit: p.kind === 'service' ? '' : p.unit,
      per: p.kind === 'service' ? '' : p.per,
    })
  }

  const isService = p.kind === 'service'

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['goods', 'service'] as const).map((k) => (
          <button
            key={k}
            onClick={() => set('kind', k)}
            className={`flex-1 rounded-xl2 border px-4 py-3 text-left transition-all duration-200 ${
              p.kind === k
                ? 'border-copper bg-copper-soft/60 shadow-[0_6px_18px_-12px_rgba(180,113,58,0.9)]'
                : 'border-line bg-card hover:border-line-2'
            }`}
          >
            <span className="block text-[14px] font-bold text-ink">
              {k === 'goods' ? 'Product' : 'Service'}
            </span>
            <span className="block text-[11.5px] text-muted">
              {k === 'goods' ? 'Has quantity and rate' : 'Lump-sum charge, no quantity'}
            </span>
          </button>
        ))}
      </div>

      <Field label={isService ? 'Service description' : 'Product name'}>
        <Input
          autoFocus
          value={p.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder={isService ? 'Service Charges for Air Compressor' : 'Air / Oil Seperator'}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={isService ? 'SAC code' : 'HSN code'}>
          <Input
            value={p.hsn}
            onChange={(e) => set('hsn', e.target.value)}
            placeholder={isService ? '998719' : '8414'}
            className="font-mono"
          />
        </Field>
        <Field label="GST rate">
          <Select value={p.gstRate} onChange={(e) => set('gstRate', Number(e.target.value))}>
            {GST_SLABS.map((g) => (
              <option key={g} value={g}>
                {g}% {g > 0 ? `(${g / 2}% + ${g / 2}% within TN)` : ''}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label={isService ? 'Default amount' : 'Rate'}>
          <Input
            type="number"
            value={p.rate || ''}
            onChange={(e) => set('rate', Number(e.target.value))}
            placeholder="0"
          />
        </Field>
        {!isService && (
          <>
            <Field label="Unit">
              <Select value={p.unit} onChange={(e) => set('unit', e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            </Field>
            <Field label="Per">
              <Select value={p.per} onChange={(e) => set('per', e.target.value)}>
                {PERS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            </Field>
          </>
        )}
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
        <Button onClick={submit}>{initial ? 'Save changes' : 'Add to catalogue'}</Button>
      </div>
    </div>
  )
}
