import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tokenHash = typeof body.token_hash === 'string' ? body.token_hash : ''

    if (!tokenHash || tokenHash.length > 2048) {
      return NextResponse.json({ error: 'This reset link is invalid or has expired.' }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    })

    if (error) {
      console.error('Recovery link verification failed:', error.message)
      return NextResponse.json({ error: 'This reset link is invalid or has expired.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Recovery confirmation failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'This reset link is invalid or has expired.' }, { status: 400 })
  }
}
