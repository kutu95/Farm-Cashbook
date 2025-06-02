import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { generateStatementPDF } from '../../utils/generateStatementPDF'

// Initialize Resend with detailed error logging
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { statements, email, month, year } = await request.json()
    
    if (!statements || !email || !month || !year) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate PDF for each statement
    try {
      // Debug logging
      console.log('Processing statements:', JSON.stringify(statements, null, 2))

      const pdfAttachments = await Promise.all(statements.map(async (statement: any) => {
        console.log('Generating PDF for party:', statement.party_name)
        console.log('Statement data:', JSON.stringify(statement.statement_data, null, 2))

        if (!statement.statement_data || !statement.statement_data.transactions) {
          throw new Error(`Invalid statement data for party ${statement.party_name}`)
        }

        // Transform transactions data
        const transactions = statement.statement_data.transactions.map((t: any) => {
          const isExpense = t.type === 'expense'
          return {
            date: t.date,
            description: t.description,
            type: isExpense ? 'Expense' : 'Payment',
            amount: isExpense ? -(t.allocated_amount || 0) : (t.amount || 0)
          }
        })

        console.log(`Transformed ${transactions.length} transactions for ${statement.party_name}:`, 
          JSON.stringify(transactions, null, 2))

        const pdfData = generateStatementPDF({
          partyName: statement.party_name,
          closingBalance: statement.statement_data.closing_balance,
          transactions
        })

        // Ensure we have a Buffer
        const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData)
        console.log(`Generated PDF for ${statement.party_name}, size:`, pdfBuffer.length)

        return {
          filename: `landlife-statement-${statement.party_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${month.toLowerCase().trim()}-${year}.pdf`,
          content: pdfBuffer
        }
      }))

      // Send email with all PDF attachments
      if (!process.env.RESEND_API_KEY) {
        console.error('RESEND_API_KEY is not configured')
        return NextResponse.json(
          { error: 'Email service is not configured' },
          { status: 500 }
        )
      }

      console.log('Attempting to send email with attachments to:', email)
      
      try {
        const emailResponse = await resend.emails.send({
          from: 'Landlife <statements@landlife.au>',
          to: email,
          subject: `Landlife Statements - ${month} ${year}`,
          html: `
            <p>Hello,</p>
            <p>Please find attached your requested statement(s).</p>
            <p>All bills from synergy can be found on Google Drive <a href="https://drive.google.com/drive/folders/1A-3aG0eZVZKzuu_4OEbYglnxe78qrTZJ">here</a>.</p>
            <p>Best regards,<br>Landlife</p>
          `,
          attachments: pdfAttachments
        })
        
        console.log('Email sent successfully:', emailResponse)
        
        return NextResponse.json({ 
          success: true, 
          message: `${pdfAttachments.length} statement(s) sent to ${email}`,
          pdfCount: pdfAttachments.length,
          emailResponse
        })
      } catch (emailError: any) {
        console.error('Resend API Error:', emailError)
        return NextResponse.json(
          { error: `Failed to send email: ${emailError.message}` },
          { status: 500 }
        )
      }
    } catch (pdfError: any) {
      console.error('PDF Generation Error:', pdfError)
      return NextResponse.json(
        { error: `Failed to generate PDF: ${pdfError.message}` },
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