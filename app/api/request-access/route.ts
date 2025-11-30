import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Initialize Resend with API key validation (lazy initialization to avoid build-time errors)
const resendApiKey = process.env.RESEND_API_KEY
if (!resendApiKey) {
  console.warn('RESEND_API_KEY is not set in environment variables - email functionality will be disabled')
}
const resend = resendApiKey ? new Resend(resendApiKey) : null

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if Resend is properly initialized
    if (!resend) {
      console.error('Resend API key is missing - cannot send access request email')
      // Return success anyway to not expose internal configuration to users
      return NextResponse.json({ 
        success: true, 
        message: 'Access request received. An administrator will review your request.'
      })
    }

    // Send email to admin
    try {
      const emailResponse = await resend.emails.send({
        from: 'Farm Cashbook <statements@landlife.au>',
        to: 'john@streamtime.com.au',
        subject: 'New Farm Cashbook Access Request',
        html: `
          <p>Hello,</p>
          <p>A new user has requested access to the Farm Cashbook app:</p>
          <p><strong>Email:</strong> ${email}</p>
          <p>Please add this user manually in Vercel if you wish to grant them access.</p>
          <p>Best regards,<br>Farm Cashbook System</p>
        `
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'Access request sent successfully'
      })
    } catch (emailError: any) {
      console.error('Email Error:', emailError)
      return NextResponse.json(
        { error: 'Failed to send access request' },
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