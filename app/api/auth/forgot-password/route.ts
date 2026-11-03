import { NextRequest, NextResponse } from 'next/server'
import { isPlausibleEmail, sendPasswordEmail } from '@/lib/auth/password-reset'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!isPlausibleEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    const result = await sendPasswordEmail(request, email, 'reset')
    if (result.status === 'missing') return NextResponse.json({ ok: true })
    if (result.status === 'failed') {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Forgot password error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not send the reset email. Try again later.' }, { status: 503 })
  }
}
