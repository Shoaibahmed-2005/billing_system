/**
 * Who at Naveen Airtech gets told about a renewal.
 *
 * Not the customer — the firm. The point of the reminder is that their own
 * people know a visit is coming up, so the numbers here are the counter's,
 * the engineer's, the owner's. The client asked for several rather than one,
 * which is the difference between a renewal being handled and a renewal
 * waiting on whoever happened to be looking at their phone.
 *
 * Kept in the settings table beside the firm's printed block, so adding a
 * number is not a code change and not a database migration.
 */

export interface ReminderPhone {
  id: string
  /** who it is, for the list — "Kumar", "Workshop" */
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
