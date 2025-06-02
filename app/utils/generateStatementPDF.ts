import jsPDF from 'jspdf'

interface Transaction {
  date: string
  description: string
  type: string
  amount: number
}

interface StatementData {
  partyName: string
  closingBalance: number
  transactions: Transaction[]
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(amount)
}

export function generateStatementPDF(data: StatementData): Buffer | Uint8Array {
  console.log('Generating PDF with data:', JSON.stringify(data, null, 2))
  
  const doc = new jsPDF()
  
  // Set font styles
  doc.setFont('helvetica')
  
  // Cover page
  doc.setFontSize(24)
  doc.text('Landlife Statement', 105, 40, { align: 'center' })
  
  doc.setFontSize(18)
  doc.text(`For ${data.partyName}`, 105, 60, { align: 'center' })
  
  doc.setFontSize(12)
  const currentDate = new Date().toLocaleString('en-AU', {
    dateStyle: 'full',
    timeStyle: 'short'
  })
  doc.text(`Issued at ${currentDate}`, 105, 80, { align: 'center' })
  
  // Balance
  doc.setFontSize(14)
  doc.text(
    `Your current balance: ${formatCurrency(data.closingBalance)}`,
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
  if (Array.isArray(data.transactions) && data.transactions.length > 0) {
    console.log(`Adding ${data.transactions.length} transactions to PDF`)
    doc.addPage()

    // Column headers
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    
    // Header background
    doc.setFillColor(240, 240, 240)
    doc.rect(15, 15, 180, 10, 'F')
    
    doc.text('Date', 20, 22)
    doc.text('Description', 50, 22)
    doc.text('Type', 110, 22)
    doc.text('Amount', 155, 22, { align: 'right' })
    doc.text('Balance', 175, 22, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    let y = 32
    const pageHeight = doc.internal.pageSize.height
    const lineHeight = 10
    let isAlternateRow = false
    let totalCredits = 0
    let totalDebits = 0
    let runningBalance = 0

    // Draw transactions
    data.transactions.forEach(transaction => {
      // Add new page if needed
      if (y > pageHeight - 30) {
        doc.addPage()
        y = 32
        isAlternateRow = false
        
        // Repeat header on new page
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setFillColor(240, 240, 240)
        doc.rect(15, 15, 180, 10, 'F')
        doc.text('Date', 20, 22)
        doc.text('Description', 50, 22)
        doc.text('Type', 110, 22)
        doc.text('Amount', 155, 22, { align: 'right' })
        doc.text('Balance', 175, 22, { align: 'right' })
        doc.setFont('helvetica', 'normal')
      }

      // Alternate row background
      if (isAlternateRow) {
        doc.setFillColor(245, 245, 245)
        doc.rect(15, y - 5, 180, lineHeight, 'F')
      }

      runningBalance += transaction.amount

      doc.setFontSize(10)
      const date = new Date(transaction.date).toLocaleDateString('en-AU')
      doc.text(date, 20, y)
      
      // Handle long descriptions
      const description = transaction.description || ''
      if (description.length > 35) {
        doc.text(description.substring(0, 32) + '...', 50, y)
      } else {
        doc.text(description, 50, y)
      }
      
      doc.text(transaction.type, 110, y)
      doc.text(formatCurrency(transaction.amount), 155, y, { align: 'right' })
      doc.text(formatCurrency(runningBalance), 175, y, { align: 'right' })

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
    doc.text('Total Credits:', 110, y)
    doc.text(formatCurrency(totalCredits), 155, y, { align: 'right' })
    
    y += lineHeight
    doc.text('Total Debits:', 110, y)
    doc.text(formatCurrency(totalDebits), 155, y, { align: 'right' })
    
    y += lineHeight
    doc.text('Balance:', 110, y)
    doc.text(formatCurrency(data.closingBalance), 155, y, { align: 'right' })
  } else {
    console.log('No transactions to add to PDF')
  }

  // Get PDF as ArrayBuffer and convert to appropriate type
  const arrayBuffer = doc.output('arraybuffer')
  
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(arrayBuffer)
  } else {
    return new Uint8Array(arrayBuffer)
  }
} 