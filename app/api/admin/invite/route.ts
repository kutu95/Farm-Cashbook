import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'

export const runtime = 'edge'

// Initialize Resend with API key validation
const resendApiKey = process.env.RESEND_API_KEY
if (!resendApiKey) {
  console.error('RESEND_API_KEY is not set in environment variables')
}
const resend = resendApiKey ? new Resend(resendApiKey) : null

// Function to generate UUID using Web Crypto API
function generateUUID() {
  return crypto.randomUUID()
}

export async function POST(request: Request) {
  try {
    console.log('=== API route called ===')

    // Get user info from request headers (set by middleware)
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    const authToken = request.headers.get('authorization')?.split('Bearer ')[1]

    console.log('Auth check:', { userId, userRole })

    if (!userId || userRole !== 'admin' || !authToken) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      }
    )
    console.log('Supabase client created')

    // Verify admin status directly
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !roleData || roleData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const { email } = await request.json()
    console.log('Received email:', email)
    
    if (!email) {
      console.log('No email provided')
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Generate a unique token for this invitation using Web Crypto API
    const token = generateUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Store the invitation in the database
    const { error: inviteError } = await supabase
      .from('user_invitations')
      .insert([
        {
          email,
          token,
          expires_at: expiresAt.toISOString(),
          invited_by: user.id
        }
      ])

    if (inviteError) {
      console.error('Invitation Error:', inviteError)
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      )
    }

    console.log('Invitation stored in database')

    // Check if Resend is properly initialized
    if (!resend) {
      console.error('Resend API key is not configured')
      return NextResponse.json(
        { error: 'Email service is not configured' },
        { status: 500 }
      )
    }

    // Send invitation email
    const signupUrl = `https://books.landlife.au/signup/invited?token=${token}`
    console.log('Signup URL generated:', signupUrl)
    
    try {
      console.log('Attempting to send email via Resend')
      await resend.emails.send({
        from: 'John <john@streamtime.com.au>',
        to: email,
        subject: 'Invitation to Farm Cashbook',
        html: `
          <p>Hello,</p>
          <p>You have been invited to join Farm Cashbook.</p>
          <p>Click the link below to complete your registration:</p>
          <p><a href="${signupUrl}">${signupUrl}</a></p>
          <p>This invitation link will expire in 7 days.</p>
          <p>Best regards,<br>Farm Cashbook Team</p>
        `
      })
      
      console.log('Email sent successfully')
      return NextResponse.json({ 
        success: true, 
        message: 'Invitation sent successfully'
      })
    } catch (emailError: any) {
      console.error('Email Error:', emailError)
      return NextResponse.json(
        { error: 'Failed to send invitation email' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Request Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }
} 