import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Public routes - no auth needed
  const publicRoutes = ['/login', '/invite', '/signup']
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  // Auth check
  if (!user) {
    // Redirect to login if trying to access protected routes
    if (!isPublicRoute) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return supabaseResponse
  }

  // User is authenticated - check profile status
  // FIX: use maybeSingle() instead of single() — a user who just signed up
  // but whose profile row hasn't been written yet would otherwise throw a
  // 406 from `.single()`, crashing the entire middleware response.
  const { data: profile } = await supabase
    .from('profiles')
    .select('status, role')
    .eq('id', user.id)
    .maybeSingle()

  // Redirect pending users to pending page
  if (profile?.status === 'pending' && pathname !== '/pending') {
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  // Redirect banned users to login with error. Skip if already headed to
  // /login — otherwise this redirects to the exact same URL forever
  // (a banned user landing on /login would get bounced to /login?error=banned,
  // which re-triggers this same check on the next request and loops).
  if (profile?.status === 'banned' && !pathname.startsWith('/login')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'banned')
    return NextResponse.redirect(loginUrl)
  }

  // FIX: a 'rejected' user with a still-valid session was never handled here
  // — only 'pending' and 'banned' redirected away from protected routes, so
  // a rejected signup could still reach /chat as long as their session
  // hadn't expired. Treat rejected the same as banned.
  if (profile?.status === 'rejected' && !pathname.startsWith('/login') && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'rejected')
    return NextResponse.redirect(loginUrl)
  }

  // Admin route protection
  if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
    return NextResponse.redirect(new URL('/chat', request.url))
  }

  // Redirect logged-in users away from auth pages
  if (isPublicRoute && profile) {
    if (profile.status === 'pending') {
      return NextResponse.redirect(new URL('/pending', request.url))
    }
    if (profile.status === 'approved') {
      return NextResponse.redirect(new URL('/chat', request.url))
    }
    // 'rejected'/'banned' users are intentionally left alone here so they
    // can still view /login (to see the error banner) or /invite/signup
    // (in case they want to try a fresh invite code).
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
