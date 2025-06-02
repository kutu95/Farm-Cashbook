import { NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU')
}

function generateStatementPDF(
  partyName: string,
  statementBalance: number,
  statements: any[]
): Buffer {
  const doc = new jsPDF()
  
  // Set font styles
  doc.setFont('helvetica')
  
  // Cover page
  doc.setFontSize(24)
  doc.text('Landlife Statement', 105, 40, { align: 'center' })
  
  doc.setFontSize(18)
  doc.text(`For ${partyName}`, 105, 60, { align: 'center' })
  
  doc.setFontSize(12)
  const currentDate = new Date().toLocaleString('en-AU', {
    dateStyle: 'full',
    timeStyle: 'short'
  })
  doc.text(`Issued at ${currentDate}`, 105, 80, { align: 'center' })
  
  // Balance
  doc.setFontSize(14)
  doc.text(
    `Your current balance: ${formatCurrency(statementBalance)}`,
    105,
    120,
    { align: 'center' }
  )
  
  // Payment details
  doc.setFontSize(12)
  doc.text('Pay by direct deposit to', 105, 160, { align: 'center' })
  doc.text('Account name: Landlife Pty Ltd', 105, 170, { align: 'center' })
  doc.text('BSB: 67873', 105, 180, { align: 'center' })
  doc.text('Account number: 16670344', 105, 190, { align: 'center' })
  
  // Contact info
  doc.setFontSize(10)
  doc.text(
    'Send any errors or omissions to john@streamtime.com.au',
    105,
    230,
    { align: 'center' }
  )

  // Transaction pages
  const statement = statements[0].statement_data
  if (statement && statement.transactions && statement.transactions.length > 0) {
    doc.addPage()

    // Column headers
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    
    // Header background
    doc.setFillColor(240, 240, 240)
    doc.rect(15, 15, 180, 10, 'F')
    
    doc.text('Date', 20, 22)
    doc.text('Description', 50, 22)
    doc.text('Reference', 120, 22)
    doc.text('Amount', 170, 22)
    doc.setFont('helvetica', 'normal')

    let y = 32
    const pageHeight = doc.internal.pageSize.height
    const lineHeight = 10
    let isAlternateRow = false
    let totalCredits = 0
    let totalDebits = 0

    // Draw transactions
    statement.transactions.forEach((transaction: any) => {
      // Add new page if needed
      if (y > pageHeight - 30) {
        doc.addPage()
        y = 32
        isAlternateRow = false
      }

      // Alternate row background
      if (isAlternateRow) {
        doc.setFillColor(245, 245, 245)
        doc.rect(15, y - 5, 180, lineHeight, 'F')
      }

      doc.setFontSize(10)
      doc.text(formatDate(transaction.date), 20, y)
      
      // Handle long descriptions
      const description = transaction.description || ''
      if (description.length > 40) {
        doc.text(description.substring(0, 37) + '...', 50, y)
      } else {
        doc.text(description, 50, y)
      }
      
      doc.text(transaction.reference || '', 120, y)
      doc.text(formatCurrency(transaction.amount), 170, y, { align: 'right' })

      // Update totals
      if (transaction.amount > 0) {
        totalCredits += transaction.amount
      } else {
        totalDebits += Math.abs(transaction.amount)
      }

      y += lineHeight
      isAlternateRow = !isAlternateRow
    })

    // Add totals section
    y += lineHeight
    doc.setFillColor(240, 240, 240)
    doc.rect(15, y - 5, 180, lineHeight * 3, 'F')
    
    doc.setFont('helvetica', 'bold')
    doc.text('Total Credits:', 120, y)
    doc.text(formatCurrency(totalCredits), 170, y, { align: 'right' })
    
    y += lineHeight
    doc.text('Total Debits:', 120, y)
    doc.text(formatCurrency(totalDebits), 170, y, { align: 'right' })
    
    y += lineHeight
    doc.text('Balance:', 120, y)
    doc.text(formatCurrency(statement.running_balance), 170, y, { align: 'right' })
  }
  
  // Convert to Buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  return pdfBuffer
}

export async function POST(request: Request) {
  try {
    const { statements, email, month, year } = await request.json()
    
    // Extract party name and balance from the first statement
    const firstStatement = statements[0]
    const partyName = firstStatement.party_name
    const statementBalance = firstStatement.statement_data?.running_balance || 0
    
    // Generate PDF
    const pdfBuffer = generateStatementPDF(partyName, statementBalance, statements)
    
    // Send email with PDF attachment
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Landlife <statements@landlife.com.au>',
        to: email,
        subject: `Landlife Statement - ${month} ${year}`,
        html: `
          <p>Dear ${partyName},</p>
          <p>Please find attached your statement for ${month} ${year}.</p>
          <p>Your current balance is ${formatCurrency(statementBalance)}.</p>
          <p>For any questions or concerns, please contact us at john@streamtime.com.au.</p>
          <p>Best regards,<br>Landlife</p>
        `,
        attachments: [{
          filename: `landlife-statement-${month.toLowerCase().trim()}-${year}.pdf`,
          content: pdfBuffer
        }]
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Statement sent to ${email}`,
      pdfSize: pdfBuffer.length
    })
  } catch (error: any) {
    console.error('Error sending statements:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send statements' },
      { status: 500 }
    )
  }
} 