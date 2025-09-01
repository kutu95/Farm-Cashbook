import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

// List of public paths that don't require authentication
const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password']

// List of admin-only paths
const adminPaths = ['/dashboard/admin', '/api/admin', '/api/admin/invite', '/manage-roles', '/manage-parties', '/add-expense', '/add-payment', '/dashboard/admin/invite', '/audit-logs', '/publishing', '/electricity-bills', '/electricity-usage-graph']

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerComponentClient({ cookies })

  // Get authenticated user
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // Check if the request is for a public path
  const isPublicPath = publicPaths.some(path => req.nextUrl.pathname.startsWith(path))
  
  // Check if the request is for an admin path
  const isAdminPath = adminPaths.some(path => req.nextUrl.pathname.startsWith(path))

  // If there is no user and the path is not public, redirect to login
  if ((!user || userError) && !isPublicPath) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    // Add the original URL as a search parameter to redirect back after login
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If this is an admin path, check admin status
  if (isAdminPath && user) {
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (roleError) {
        console.error('Error checking admin status:', roleError)
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/dashboard'
        return NextResponse.redirect(redirectUrl)
      }

      if (!roleData || roleData.role !== 'admin') {
        // If not admin, redirect to dashboard
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/dashboard'
        return NextResponse.redirect(redirectUrl)
      }
    } catch (error) {
      // On error, redirect to dashboard
      console.error('Error in admin check:', error)
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // If there is a user and they're on a public path (like login), 
  // redirect them to the dashboard
  if (user && isPublicPath) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // Add the user and session info to the request headers for use in API routes
  if (user) {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', user.id)
    
    // Only set admin role if we've confirmed the user is an admin
    if (isAdminPath) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (roleData?.role === 'admin') {
        requestHeaders.set('x-user-role', 'admin')
      }
    }

    if (session?.access_token) {
      requestHeaders.set('authorization', `Bearer ${session.access_token}`)
    }
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  return response
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
} 