/**
 * The numbers a renewal reminder goes to.
 *
 * Just a list. Whoever has access to the site adds numbers, and every one
 * of them gets the message — the counter, the engineer, the owner, the
 * customer if that is what they want. The code does not assume whose they
 * are, which is the point: it is a setting, not a rule.
 *
 * Several rather than one is the whole point, and the client's reason for
 * it is worth keeping: three or four people at the firm watch these, so
 * that one of them forgetting is not a renewal missed. A single number is
 * a single point of failure, and the failure is silent.
 *
 * Kept in the settings table beside the firm's printed block, so adding a
 * number is not a code change and not a database migration.
 */

export interface ReminderPhone {
  id: string
  /** a label for the list — "Kumar", "Workshop", "Delta purchase" */
  name: string
  phone: string
}

export interface ReminderSettings {
  phones: ReminderPhone[]
  /**
   * Days before the end date that the messages start. They then repeat
   * daily until the contract is renewed or switched off.
   */
  startDays: number
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  phones: [],
  startDays: 7,
}
