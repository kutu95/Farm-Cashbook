import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Send email to admin
    try {
      const emailResponse = await resend.emails.send({
        from: 'Landlife <statements@landlife.au>',
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