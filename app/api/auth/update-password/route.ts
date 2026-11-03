import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const password = typeof body.password === 'string' ? body.password : ''

    if (password.length < 6 || password.length > 1024) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Open the reset link from your email again, then choose a new password.' }, { status: 401 })
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      console.error('Password update failed:', error.message)
      return NextResponse.json({ error: 'Could not update the password. Request a new reset link and try again.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Password update failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not update the password. Request a new reset link and try again.' }, { status: 400 })
  }
}
