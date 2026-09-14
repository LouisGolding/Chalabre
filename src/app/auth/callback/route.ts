import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Behind a proxy (Vercel) request.url carries the internal origin, so redirects
// built from it land on the deployment URL instead of labatisse.art.
function resolveOrigin(request: Request, origin: string) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (process.env.NODE_ENV === 'development' || !forwardedHost) return origin
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${forwardedHost}`
}

// Only ever bounce to a path on this site.
function safeNext(next: string | null) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard'
  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const baseUrl = resolveOrigin(request, origin)
  const next = safeNext(searchParams.get('next'))

  // The login page turns these codes into French copy. The real reason is
  // logged rather than echoed back through the URL.
  const failure = (code: 'oauth' | 'exchange' | 'otp' | 'invalid', detail?: string) => {
    console.error(`[auth/callback] ${code}${detail ? `: ${detail}` : ''}`)
    return NextResponse.redirect(`${baseUrl}/auth/login?error=${code}`)
  }

  // Google (or Supabase) can bounce back with an error and no code at all —
  // consent declined, provider misconfigured, expired link.
  const providerError = searchParams.get('error_description') ?? searchParams.get('error')
  if (providerError) return failure('oauth', providerError)

  const supabase = await createClient()

  // OAuth and PKCE magic links come back with ?code=
  const code = searchParams.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return failure('exchange', error.message)
    return NextResponse.redirect(`${baseUrl}${next}`)
  }

  // Email confirmation / recovery links come back with ?token_hash=&type=.
  // These work from any device, unlike the PKCE code exchange above.
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) return failure('otp', error.message)
    return NextResponse.redirect(`${baseUrl}${next}`)
  }

  return failure('invalid')
}
