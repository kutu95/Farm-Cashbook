import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const PRODUCTION_ORIGIN = 'https://books.landlife.au'

export function appOrigin(request: { headers: Headers; nextUrl: URL }) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host')?.split(',')[0]?.trim() || ''
  const hostname = host.replace(/^\[|\]$/g, '').split(':')[0]

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http'
    return `${proto}://${host}`
  }

  return PRODUCTION_ORIGIN
}

export function isPlausibleEmail(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function missingUser(error: { message?: string; status?: number; code?: string }) {
  const message = error.message?.toLowerCase() || ''
  return error.status === 404
    || error.code === 'user_not_found'
    || message.includes('user not found')
    || message.includes('unable to find user')
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

type PasswordEmailKind = 'reset' | 'welcome'

export type PasswordEmailResult =
  | { status: 'sent' }
  | { status: 'missing' }
  | { status: 'failed'; httpStatus: number; error: string }

export async function sendPasswordEmail(
  request: { headers: Headers; nextUrl: URL },
  email: string,
  kind: PasswordEmailKind,
): Promise<PasswordEmailResult> {
  const resendKey = process.env.RESEND_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!resendKey || !supabaseUrl || !serviceKey) {
    console.error('Password email was not sent because email or auth is not configured')
    return { status: 'failed', httpStatus: 503, error: 'Could not send the email. Try again later.' }
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  if (error || !data.properties?.hashed_token) {
    if (error && missingUser(error)) {
      return { status: 'missing' }
    }
    console.error('Could not create a password link:', error?.message || 'missing token')
    return { status: 'failed', httpStatus: 503, error: 'Could not send the email. Try again later.' }
  }

  const resetUrl = new URL('/reset-password', appOrigin(request))
  resetUrl.searchParams.set('token_hash', data.properties.hashed_token)
  resetUrl.searchParams.set('type', 'recovery')
  const safeUrl = escapeHtml(resetUrl.toString())

  const subject = kind === 'welcome'
    ? 'Your Farm Cashbook account'
    : 'Reset your Farm Cashbook password'
  const intro = kind === 'welcome'
    ? 'An account has been created for you on Farm Cashbook. Choose a password to sign in.'
    : 'We received a request to reset the password for your Farm Cashbook account.'
  const closing = kind === 'welcome'
    ? 'This link opens the page where you set your password. It is valid for a short time. Ask an admin to send a new link if this one expires.'
    : 'This link is valid for a short time. If you did not request this, you can ignore this email. Your current password stays the same until you choose a new one.'

  const { error: emailError } = await new Resend(resendKey).emails.send({
    from: 'Farm Cashbook <statements@margies.app>',
    to: [email],
    subject,
    html: `
      <p>Hello,</p>
      <p>${intro}</p>
      <p><a href="${safeUrl}">Choose a password</a></p>
      <p>${closing}</p>
      <p>If the button does not work, copy this link into your browser:</p>
      <p>${safeUrl}</p>
      <p>Best regards,<br>Farm Cashbook</p>
    `,
  })

  if (emailError) {
    console.error('Resend password email error:', emailError)
    return { status: 'failed', httpStatus: 503, error: 'Could not send the email. Try again later.' }
  }

  return { status: 'sent' }
}
