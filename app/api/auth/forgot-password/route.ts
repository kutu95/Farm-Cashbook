import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { appOrigin, escapeHtml, isPlausibleEmail, missingUser } from '@/lib/auth/password-reset'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!isPlausibleEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    const resendKey = process.env.RESEND_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!resendKey || !supabaseUrl || !serviceKey) {
      console.error('Password reset email was not sent because email or auth is not configured')
      return NextResponse.json({ error: 'Could not send the reset email. Try again later.' }, { status: 503 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    if (error || !data.properties?.hashed_token) {
      if (error && missingUser(error)) {
        return NextResponse.json({ ok: true })
      }

      console.error('Could not create a password reset link:', error?.message || 'missing token')
      return NextResponse.json({ error: 'Could not send the reset email. Try again later.' }, { status: 503 })
    }

    const resetUrl = new URL('/reset-password', appOrigin(request))
    resetUrl.searchParams.set('token_hash', data.properties.hashed_token)
    resetUrl.searchParams.set('type', 'recovery')

    const safeUrl = escapeHtml(resetUrl.toString())
    const { error: emailError } = await new Resend(resendKey).emails.send({
      from: 'Farm Cashbook <statements@landlife.au>',
      to: [email],
      subject: 'Reset your Farm Cashbook password',
      html: `
        <p>Hello,</p>
        <p>We received a request to reset the password for your Farm Cashbook account.</p>
        <p><a href="${safeUrl}">Choose a new password</a></p>
        <p>This link is valid for a short time. If you did not request this, you can ignore this email. Your current password stays the same until you choose a new one.</p>
        <p>If the button does not work, copy this link into your browser:</p>
        <p>${safeUrl}</p>
        <p>Best regards,<br>Farm Cashbook</p>
      `,
    })

    if (emailError) {
      console.error('Resend password reset error:', emailError)
      return NextResponse.json({ error: 'Could not send the reset email. Try again later.' }, { status: 503 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Forgot password error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not send the reset email. Try again later.' }, { status: 503 })
  }
}
