import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Reachable without a session.
const PUBLIC_PATHS = ['/']

// Public sections, reachable without a session along with everything below
// them. /bienvenue = manifeste + mode d'emploi en vidéos, envoyé à la famille
// par lien avant qu'elle ait un compte (fichiers statiques dans
// public/bienvenue/).
const PUBLIC_PREFIXES = ['/bienvenue']

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.includes(pathname) ||
  PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))

// Auth forms an already signed-in visitor should not sit on.
// /auth/callback is deliberately absent: it still has a code to exchange.
const AUTH_FORM_PATHS = ['/auth/login', '/auth/register']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // getUser() may have rotated the tokens; those refreshed cookies live on
  // supabaseResponse, so any redirect we return has to carry them over or the
  // browser keeps replaying the stale session.
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ''
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return response
  }

  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/auth')

  if (!user && !isAuthRoute && !isPublicPath(pathname)) {
    return redirectTo('/auth/login')
  }

  if (user && AUTH_FORM_PATHS.includes(pathname)) {
    return redirectTo('/dashboard')
  }

  return supabaseResponse
}
