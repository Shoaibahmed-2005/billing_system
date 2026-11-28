/**
 * Annual maintenance.
 *
 * A machine is sold or serviced, maintenance runs for a year, and someone
 * has to be told before it lapses. Everything here is about that: what is
 * covered, when the year is up, and who to tell.
 *
 * Three things the client was specific about.
 *
 * The reminder goes to a list of numbers kept in the settings, however many
 * of them there are and whoever they belong to. What it carries is the
 * facts someone needs in order to act: which company, which machine, when
 * it started and when it runs out.
 *
 * It repeats. One message on the last day is no use to anybody — it starts
 * several days out and goes again each day until the contract is renewed or
 * switched off.
 *
 * The amount is optional. Some contracts are priced here, some are settled
 * between them and the customer and the figure never reaches the website, so
 * an unpriced contract is a normal contract and not a half-filled one.
 *
 * Dates are the dotted strings the rest of the system uses — "27.11.2026" —
 * because that is what the counter types and what the bills print. They are
 * parsed where arithmetic is needed and left alone everywhere else.
 */

export interface Amc {
  id: string
  /** the company this is for; the name is kept beside it so a renamed or
   *  deleted company never leaves a contract pointing at nothing */
  companyId: string | null
  companyName: string
  /** what is covered — "Hi-Tech 15HP Screw Air Compressor" */
  equipment: string
  /** the catalogue entry it was sold from, when it came from there */
  productId: string | null
  /** the bill it went out on — "052/2026-2027" — so the sale can be found */
  invoiceNo: string
  /** machine or serial number, when they have one */
  serialNo: string
  startDate: string
  endDate: string
  /** null when the price is not being tracked here */
  amount: number | null
  notes: string
  /** a contract that has been renewed elsewhere, or dropped, stops nagging */
  active: boolean
  /** ISO timestamp of the last reminder, so the same one is not sent twice */
  lastRemindedAt?: string
  createdAt: string
}

/* ----------------------------------------------------------------- dates */

/** "27.11.2026" -> Date, or null if it is not a date. */
export const parseDotted = (s: string): Date | null => {
  const m = /^\s*(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\s*$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return Number.isNaN(d.getTime()) ? null : d
}

export const formatDotted = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

/**
 * A year on, minus a day: a contract starting 27.11.2026 covers up to
 * 26.11.2027, which is how the firm reads it. February the 29th lands on
 * the 28th, which is what the calendar does on its own.
 */
export const oneYearOn = (start: string): string => {
  const d = parseDotted(start)
  if (!d) return ''
  const end = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate())
  end.setDate(end.getDate() - 1)
  return formatDotted(end)
}

/** Whole days from today to the end date; negative once it has lapsed. */
export const daysLeft = (amc: Amc, today = new Date()): number | null => {
  const end = parseDotted(amc.endDate)
  if (!end) return null
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/* ---------------------------------------------------------------- status */

export type AmcStatus = 'expired' | 'due' | 'running' | 'stopped' | 'undated'

/** How far ahead a contract starts showing on the due list. */
export const DUE_WINDOW_DAYS = 45

/**
 * How many days before the end date the messages start, and they go every
 * day from then until the end date passes.
 *
 * The client asked for "at least the past 3 or 4 days"; seven gives them a
 * working week to arrange the visit, which is the point of knowing early.
 */
export const REMIND_FROM_DAYS = 7

export const amcStatus = (amc: Amc, today = new Date()): AmcStatus => {
  if (!amc.active) return 'stopped'
  const left = daysLeft(amc, today)
  if (left === null) return 'undated'
  if (left < 0) return 'expired'
  if (left <= DUE_WINDOW_DAYS) return 'due'
  return 'running'
}

export const STATUS_LABEL: Record<AmcStatus, string> = {
  expired: 'Lapsed',
  due: 'Due',
  running: 'Running',
  stopped: 'Stopped',
  undated: 'No end date',
}

/**
 * Everything that wants a reminder today, soonest first.
 *
 * Lapsed contracts are included deliberately — a contract that ran out
 * three weeks ago is more urgent than one running out next month, not less,
 * and leaving it off the list is how it gets forgotten.
 */
export const needingReminder = (list: Amc[], today = new Date()): Amc[] =>
  list
    .filter((a) => {
      const s = amcStatus(a, today)
      return s === 'due' || s === 'expired'
    })
    .sort((a, b) => (daysLeft(a, today) ?? 0) - (daysLeft(b, today) ?? 0))

/**
 * Whether this contract should be messaged about today.
 *
 * True from a week before the end date until it lapses, and once lapsed it
 * keeps going — a contract that ran out last week is the one most in need
 * of a telephone call, not the one to stop mentioning.
 */
export const isRemindable = (amc: Amc, today = new Date()): boolean => {
  if (!amc.active) return false
  const left = daysLeft(amc, today)
  return left !== null && left <= REMIND_FROM_DAYS
}

/** True when today's message has already gone out. */
export const remindedToday = (amc: Amc, today = new Date()): boolean => {
  if (!amc.lastRemindedAt) return false
  const sent = new Date(amc.lastRemindedAt)
  return (
    sent.getFullYear() === today.getFullYear() &&
    sent.getMonth() === today.getMonth() &&
    sent.getDate() === today.getDate()
  )
}

/**
 * The words that go out.
 *
 * It names the company, the machine and both dates, because that is what
 * someone reading it on a phone needs in order to act without opening
 * anything else.
 */
export const reminderText = (amc: Amc, today = new Date()): string => {
  const left = daysLeft(amc, today)
  const when =
    left === null
      ? 'No end date recorded'
      : left < 0
        ? `LAPSED ${-left} day${left === -1 ? '' : 's'} ago`
        : left === 0
          ? 'Ends TODAY'
          : `${left} day${left === 1 ? '' : 's'} left`

  return [
    `AMC renewal — ${when}`,
    ``,
    `Company : ${amc.companyName || '—'}`,
    `Machine : ${amc.equipment || '—'}${amc.serialNo ? ` (${amc.serialNo})` : ''}`,
    `Started : ${amc.startDate || '—'}`,
    `Ends    : ${amc.endDate || '—'}`,
    ...(amc.invoiceNo ? [`Bill    : ${amc.invoiceNo}`] : []),
  ].join('\n')
}

/**
 * A contract started off a quotation.
 *
 * The year runs from the date on the quotation, which is the date the
 * machine was quoted and, near enough, the date it went out — the firm
 * counts the year from the paperwork, not from a separate decision made
 * later. Everything else is carried across so the form opens filled in
 * rather than empty: the company, the first line as the machine, and the
 * quotation's number so the two can be put side by side afterwards.
 *
 * It is a starting point, not a record: nothing is saved until the form is
 * saved, and every field on it can be typed over first.
 */
export const amcFromQuote = (q: {
  id: string
  meta: { slNo: string; dated: string }
  buyer: { id: string; name: string }
  items: { description: string; productId: string | null }[]
}, id: string): Amc => {
  const start = parseDotted(q.meta.dated) ? q.meta.dated : formatDotted(new Date())
  const first = q.items[0]
  return {
    id,
    companyId: q.buyer.id,
    companyName: q.buyer.name,
    equipment: first?.description ?? '',
    productId: first?.productId ?? null,
    invoiceNo: q.meta.slNo ? `Quotation ${q.meta.slNo}` : '',
    serialNo: '',
    startDate: start,
    endDate: oneYearOn(start),
    amount: null,
    notes: '',
    active: true,
    createdAt: new Date().toISOString(),
  }
}

/**
 * The same contract, another year.
 *
 * A renewal picks up the day after the old one ran out, not today: a
 * contract that lapsed three weeks ago and is being renewed now has not
 * been uncovered for those three weeks, and dating it today would quietly
 * lose them. If the old end date is unreadable, it starts today instead,
 * which is the only other honest answer.
 *
 * Whoever has been reminded about the old year has not been reminded about
 * the new one, so that is cleared — otherwise the first reminder of next
 * year would be suppressed as "already sent today".
 */
export const renewed = (amc: Amc, today = new Date()): Amc => {
  const end = parseDotted(amc.endDate)
  const start = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1) : today
  const startDate = formatDotted(start)
  return {
    ...amc,
    startDate,
    endDate: oneYearOn(startDate),
    active: true,
    lastRemindedAt: undefined,
  }
}
