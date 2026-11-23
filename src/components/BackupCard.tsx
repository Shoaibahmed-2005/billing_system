import { useRef, useState } from 'react'
import {
  backupFileName,
  billsWorkbook,
  companiesWorkbook,
  nothingRestored,
  productsWorkbook,
  restoreFromWorkbook,
  type RestoreReport,
} from '../lib/backup'
import { downloadBlob } from '../lib/pdf'
import { listCompanies, listInvoices, listProducts } from '../lib/store'
import { Button, Card, CardHead } from './ui'

/**
 * Their own backup, in the Settings page.
 *
 * Supabase charges for backups, so this is how the firm keeps one: three
 * spreadsheets they download whenever they like — end of the month, usually —
 * and one button that reads any of them back in.
 *
 * Reading back only ever restores what has gone missing. Nothing already in
 * the system is touched, so loading last quarter's file by mistake cannot
 * undo this quarter's prices. The report afterwards says what happened in
 * plain numbers, because "it worked" is not reassuring enough for something
 * people press when they are already worried.
 */
export default function BackupCard({ onChanged }: { onChanged: () => void }) {
  const picker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [report, setReport] = useState<RestoreReport | null>(null)

  const save = async (what: string, build: () => Promise<Blob>) => {
    setError('')
    setReport(null)
    setBusy(what)
    try {
      downloadBlob(await build(), backupFileName(what))
    } catch {
      setError(`Could not build the ${what} file.`)
    } finally {
      setBusy('')
    }
  }

  const load = async (file: File) => {
    setError('')
    setReport(null)
    setBusy('import')
    try {
      const result = await restoreFromWorkbook(file)
      setReport(result)
      if (!nothingRestored(result)) onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      setBusy('')
    }
  }

  return (
    <Card>
      <CardHead
        title="Backup"
        subtitle="Download the catalogue and the ledger as Excel, and load them back if anything is ever lost."
      />

      {/*
        One per line on a phone. Four buttons of different lengths left to
        wrap on their own came out in a ragged stack of ones and twos, which
        reads as a mistake; a full-width column reads as a menu.
      */}
      <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5 sm:px-6">
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={() => save('products', async () => productsWorkbook(await listProducts()))}
        >
          {busy === 'products' ? 'Building…' : 'Download products'}
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={() => save('companies', async () => companiesWorkbook(await listCompanies()))}
        >
          {busy === 'companies' ? 'Building…' : 'Download companies'}
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={() => save('bills', async () => billsWorkbook(await listInvoices()))}
        >
          {busy === 'bills' ? 'Building…' : 'Download bills'}
        </Button>

        <span className="hidden h-6 w-px bg-line sm:block" />

        <Button
          className="w-full sm:w-auto"
          size="sm"
          disabled={!!busy}
          onClick={() => picker.current?.click()}
        >
          {busy === 'import' ? 'Reading…' : 'Import a backup'}
        </Button>
        <input
          ref={picker}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            // cleared so the same file can be picked twice in a row
            e.target.value = ''
            if (file) void load(file)
          }}
        />
      </div>

      <div className="border-t border-line px-4 py-4 text-[12.5px] text-muted sm:px-6">
        {error ? (
          <p className="font-semibold text-clay">{error}</p>
        ) : report ? (
          <Report report={report} />
        ) : (
          <p>
            Importing only puts back what has gone missing. Anything still here is left exactly as
            it is, so an old file can never overwrite today's prices.
          </p>
        )}
      </div>
    </Card>
  )
}

function Report({ report }: { report: RestoreReport }) {
  const lines: string[] = []
  const say = (what: string, c: { added: number; alreadyThere: number; skipped: number }) => {
    if (!c.added && !c.alreadyThere && !c.skipped) return
    const parts = [`${c.alreadyThere} already here`]
    if (c.added) parts.unshift(`${c.added} put back`)
    if (c.skipped) parts.push(`${c.skipped} unreadable`)
    lines.push(`${what}: ${parts.join(', ')}`)
  }

  say('Products', report.products)
  say('Companies', report.companies)
  say('Bills', report.bills)

  if (!lines.length) {
    return <p className="font-semibold text-ink">Nothing in that file this app recognised.</p>
  }

  return (
    <div className="space-y-1">
      <p className="font-semibold text-sage">
        {nothingRestored(report)
          ? 'Everything in that file is already here — nothing changed.'
          : 'Done.'}
      </p>
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
      {report.ignored.length ? (
        <p>Left alone: {report.ignored.join(', ')}.</p>
      ) : null}
    </div>
  )
}
