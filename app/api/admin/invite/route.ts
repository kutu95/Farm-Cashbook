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

// Helper function to create a response with CORS headers
function corsResponse(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function OPTIONS() {
  return corsResponse({})
}

export async function POST(request: Request) {
  try {
    console.log('=== API route called ===')

    // Get user info from request headers (set by middleware)
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    const authToken = request.headers.get('authorization')?.split('Bearer ')[1]

    console.log('Auth check:', { userId, userRole, hasAuthToken: !!authToken })

    if (!userId || userRole !== 'admin' || !authToken) {
      return corsResponse(
        { error: 'Unauthorized - Admin access required' },
        403
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
      console.error('Auth error:', userError)
      return corsResponse(
        { error: 'Authentication failed' },
        401
      )
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (roleError) {
      console.error('Role check error:', roleError)
      return corsResponse(
        { error: 'Error checking admin privileges' },
        500
      )
    }

    if (!roleData || roleData.role !== 'admin') {
      console.error('User is not admin:', { roleData })
      return corsResponse(
        { error: 'Admin privileges required' },
        403
      )
    }

    const body = await request.json()
    const { email } = body
    console.log('Received email:', email)
    
    if (!email) {
      console.log('No email provided')
      return corsResponse(
        { error: 'Email is required' },
        400
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
      return corsResponse(
        { error: 'Failed to create invitation' },
        500
      )
    }

    console.log('Invitation stored in database')

    // Check if Resend is properly initialized
    if (!resend) {
      console.error('Resend API key:', process.env.RESEND_API_KEY ? 'Present' : 'Missing')
      return corsResponse(
        { error: 'Email service is not configured' },
        500
      )
    }

    // Send invitation email
    const signupUrl = `https://books.landlife.au/signup/invited?token=${token}`
    console.log('Signup URL generated:', signupUrl)
    
    try {
      console.log('Attempting to send email via Resend with config:', {
        from: 'Farm Cashbook <statements@landlife.au>',
        to: email,
        subject: 'Invitation to Farm Cashbook'
      })

      const emailResult = await resend.emails.send({
        from: 'Farm Cashbook <statements@landlife.au>',
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
      
      console.log('Email send result:', emailResult)
      return corsResponse({ 
        success: true, 
        message: 'Invitation sent successfully',
        emailData: emailResult
      })
    } catch (emailError: any) {
      console.error('Email Error:', {
        error: emailError,
        message: emailError.message,
        name: emailError.name,
        stack: emailError.stack,
        code: emailError.code
      })
      return corsResponse(
        { 
          error: 'Failed to send invitation email',
          details: emailError.message
        },
        500
      )
    }
  } catch (error: any) {
    console.error('Request Error:', {
      error,
      message: error.message,
      name: error.name,
      stack: error.stack
    })
    return corsResponse(
      { error: error.message },
      400
    )
  }
} 