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

  // Redirect banned users to login with error
  if (profile?.status === 'banned') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'banned')
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
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
