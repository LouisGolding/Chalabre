import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client. Bypasses RLS, so it is server-only — never import this
 * from a component that ships to the browser.
 *
 * Needed by the Stripe webhook: it arrives without a session, so the anon-key
 * client is treated as an unauthenticated user and every write is dropped by
 * RLS without raising an error.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
