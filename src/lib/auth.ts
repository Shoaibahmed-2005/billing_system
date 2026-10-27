import { hasSupabaseConfig, supabase } from './backends/supabase'

/**
 * Sign-in is only in the way when the app is pointed at Supabase. On browser
 * storage there is nothing to protect and no server to ask, so the counter
 * opens straight away.
 */
export const authEnabled = hasSupabaseConfig()

export interface Account {
  email: string
}

/** Supabase's own wording is terse and a bit technical; this is for the counter. */
const friendly = (message: string): string => {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'That email and password do not match.'
  if (m.includes('email not confirmed')) return 'This account still needs its email confirmed.'
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Too many attempts. Wait a minute and try again.'
  if (m.includes('failed to fetch') || m.includes('networkerror'))
    return 'Could not reach the server. Check the internet connection.'
  return message
}

export const currentAccount = async (): Promise<Account | null> => {
  if (!authEnabled) return null
  const { data, error } = await supabase().auth.getSession()
  if (error || !data.session?.user.email) return null
  return { email: data.session.user.email }
}

/** Keeps the app in step when the session is refreshed, expires, or is signed out. */
export const onAuthChange = (cb: (account: Account | null) => void): (() => void) => {
  if (!authEnabled) return () => {}
  const { data } = supabase().auth.onAuthStateChange((_event, session) => {
    cb(session?.user.email ? { email: session.user.email } : null)
  })
  return () => data.subscription.unsubscribe()
}

export const signIn = async (email: string, password: string): Promise<void> => {
  const { error } = await supabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw new Error(friendly(error.message))
}

export const signOut = async (): Promise<void> => {
  if (!authEnabled) return
  await supabase().auth.signOut()
}
