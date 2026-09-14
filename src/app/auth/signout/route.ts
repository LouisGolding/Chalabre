import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST-only so a stray <img src="/auth/signout"> can't log anyone out.
export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/auth/login', request.url), { status: 303 })
}
