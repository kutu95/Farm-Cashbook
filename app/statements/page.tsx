"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { useAuth } from "@/context/AuthContext"
import Link from "next/link"

interface Expense {
  id: string
  description: string
  expense_date: string
  amount: number
}

interface ExpenseAllocation {
  allocated_amount: number
  expenses: Expense
  party_id: string
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  description?: string
  party_id: string
}

interface Party {
  id: string
  name: string
}

interface RawExpenseResponse {
  allocated_amount: number
  expense_id: Expense
  party_id: string
}

function StatementsContent() {
  const { session, loading } = useAuth()
  const searchParams = useSearchParams()
  const [parties, setParties] = useState<Party[]>([])
  const [partyId, setPartyId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [rawExpenses, setRawExpenses] = useState<ExpenseAllocation[]>([])
  const [rawPayments, setRawPayments] = useState<Payment[]>([])
  const [error, setError] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortAscending, setSortAscending] = useState(true)

  useEffect(() => { 
    if (!loading) {
      loadParties() 
    }
  }, [loading])
  
  useEffect(() => {
    const urlPartyId = searchParams.get('party')
    if (urlPartyId) {
      setPartyId(urlPartyId)
    }
  }, [searchParams])

  useEffect(() => { 
    if (partyId) loadStatementsForParty(partyId) 
  }, [partyId])

  useEffect(() => {
    if (!loading && session?.user) {
      checkAdminStatus()
    }
  }, [session, loading])

  const checkAdminStatus = async () => {
    if (!session?.user?.id) return
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

      if (error) {
        console.error('Error checking admin status:', error)
        return
      }

      setIsAdmin(data?.role === 'admin')
    } catch (err) {
      console.error('Error checking admin status:', err)
    }
  }

  const loadParties = async () => {
    const { data, error } = await supabase.from("parties").select("*")
    if (error) setError(error.message)
    else setParties(data)
  }

  const loadStatementsForParty = async (partyId: string) => {
    const [expensesResponse, paymentsResponse] = await Promise.all([
      supabase
        .from("expense_allocations")
        .select(`
          allocated_amount,
          expense_id (
            id,
            description,
            expense_date,
            amount
          ),
          party_id
        `)
        .eq("party_id", partyId),
      supabase
        .from("payments")
        .select("*")
        .eq("party_id", partyId)
        .order("payment_date", { ascending: true })
    ])

    if (expensesResponse.error) {
      setError(expensesResponse.error.message)
      console.error('Expenses error:', expensesResponse.error)
    } else {
      console.log('Expenses data:', expensesResponse.data)
      
      // Transform the raw response into the expected format with proper type casting
      const transformedExpenses = ((expensesResponse.data as unknown) as RawExpenseResponse[]).map(item => ({
        allocated_amount: item.allocated_amount,
        expenses: item.expense_id,
        party_id: item.party_id
      }))

      // Sort the transformed expenses
      const sortedExpenses = transformedExpenses
        .filter(expense => expense.expenses !== null)
        .sort((a, b) => {
          if (!a.expenses?.expense_date || !b.expenses?.expense_date) return 0
          return a.expenses.expense_date.localeCompare(b.expenses.expense_date)
        })
      
      setRawExpenses(sortedExpenses)
    }

    if (paymentsResponse.error) {
      setError(paymentsResponse.error.message)
      console.error('Payments error:', paymentsResponse.error)
    } else {
      console.log('Payments data:', paymentsResponse.data)
      setRawPayments(paymentsResponse.data)
    }
  }

  const generatePDF = () => {
    const doc = new jsPDF()
    const party = parties.find(p => p.id === partyId)
    
    // Prepare transactions data
    const transactions = [
      ...rawExpenses
        .filter(expense => 
          expense.expenses &&
          (!startDate || expense.expenses.expense_date >= startDate) &&
          (!endDate || expense.expenses.expense_date <= endDate)
        )
        .map(expense => ({
          date: expense.expenses.expense_date,
          description: expense.expenses.description,
          type: 'Expense',
          amount: -expense.allocated_amount
        })),
      ...rawPayments
        .filter(payment => 
          (!startDate || payment.payment_date >= startDate) &&
          (!endDate || payment.payment_date <= endDate)
        )
        .map(payment => ({
          date: payment.payment_date,
          description: payment.description || 'Payment',
          type: 'Payment',
          amount: payment.amount
        }))
    ]
    .sort((a, b) => a.date.localeCompare(b.date))

    // Set font styles
    doc.setFont('helvetica')
    
    // Cover page
    doc.setFontSize(24)
    doc.text('Landlife Statement', 105, 40, { align: 'center' })
    
    doc.setFontSize(18)
    doc.text(`For ${party?.name}`, 105, 60, { align: 'center' })
    
    doc.setFontSize(12)
    const currentDate = new Date().toLocaleString('en-AU', {
      dateStyle: 'full',
      timeStyle: 'short'
    })
    doc.text(`Issued at ${currentDate}`, 105, 80, { align: 'center' })
    
    // Balance
    doc.setFontSize(14)
    doc.text(
      `Your current balance: ${balance.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}`,
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
    if (transactions.length > 0) {
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
      transactions.forEach(item => {
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

        runningBalance += item.amount

        doc.setFontSize(10)
        doc.text(new Date(item.date).toLocaleDateString('en-AU'), 20, y)
        
        // Handle long descriptions
        const description = item.description || ''
        if (description.length > 35) {
          doc.text(description.substring(0, 32) + '...', 50, y)
        } else {
          doc.text(description, 50, y)
        }
        
        doc.text(item.type, 110, y)
        doc.text(item.amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' }), 155, y, { align: 'right' })
        doc.text(runningBalance.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' }), 175, y, { align: 'right' })

        // Update totals
        if (item.amount > 0) {
          totalCredits += item.amount
        } else {
          totalDebits += Math.abs(item.amount)
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
      doc.text(totalCredits.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' }), 155, y, { align: 'right' })
      
      y += lineHeight
      doc.text('Total Debits:', 110, y)
      doc.text(totalDebits.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' }), 155, y, { align: 'right' })
      
      y += lineHeight
      doc.text('Balance:', 110, y)
      doc.text(balance.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' }), 155, y, { align: 'right' })
    }
    
    // Save PDF
    doc.save(`statement_${party?.name}_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const generateCSV = () => {
    const party = parties.find(p => p.id === partyId)
    let csvContent = "Date,Description,Type,Amount,Balance\n"
    
    const transactions = [
      ...rawExpenses
        .filter(expense => 
          expense.expenses &&
          (!startDate || expense.expenses.expense_date >= startDate) &&
          (!endDate || expense.expenses.expense_date <= endDate)
        )
        .map(expense => ({
          date: expense.expenses.expense_date,
          description: expense.expenses.description,
          type: 'Expense',
          amount: -expense.allocated_amount
        })),
      ...rawPayments
        .filter(payment => 
          (!startDate || payment.payment_date >= startDate) &&
          (!endDate || payment.payment_date <= endDate)
        )
        .map(payment => ({
          date: payment.payment_date,
          description: payment.description || 'Payment',
          type: 'Payment',
          amount: payment.amount
        }))
    ]
    .sort((a, b) => sortAscending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))
    
    // Calculate running balance
    let runningBalance = 0
    transactions.forEach(item => {
      runningBalance += item.amount
      csvContent += `${item.date},"${item.description}",${item.type},${item.amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })},${runningBalance.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}\n`
    })
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `statement_${party?.name}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Calculate total balance
  const totalPayments = rawPayments.reduce((sum, p) => sum + p.amount, 0)
  const totalExpenses = rawExpenses.reduce((sum, e) => sum + e.allocated_amount, 0)
  const balance = totalPayments - totalExpenses

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <Header />
      <h1 className="text-2xl font-bold mb-6">Statements</h1>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Party</label>
                <select 
                  value={partyId} 
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select a party...</option>
                  {parties.map(party => (
                    <option key={party.id} value={party.id}>{party.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Description</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search descriptions..."
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
          </div>

          {partyId && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Statement Details</h2>
                <div className="space-x-2">
                  <button
                    onClick={generatePDF}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Export PDF
                  </button>
                  <button
                    onClick={generateCSV}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left">
                        <div className="flex items-center gap-2">
                          Date
                          <button
                            onClick={() => setSortAscending(!sortAscending)}
                            className="text-gray-500 hover:text-gray-700"
                            title={sortAscending ? "Sort Descending" : "Sort Ascending"}
                          >
                            {sortAscending ? "↑" : "↓"}
                          </button>
                        </div>
                      </th>
                      <th className="px-4 py-2 text-left">Description</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Combine and sort expenses and payments */}
                    {[
                      ...rawExpenses
                        .filter(expense => 
                          expense.expenses &&
                          (!startDate || expense.expenses.expense_date >= startDate) &&
                          (!endDate || expense.expenses.expense_date <= endDate) &&
                          (!searchTerm || expense.expenses.description.toLowerCase().includes(searchTerm.toLowerCase()))
                        )
                        .map(expense => ({
                          date: expense.expenses.expense_date,
                          description: expense.expenses.description,
                          type: 'Expense',
                          amount: -expense.allocated_amount,
                          id: expense.expenses.id,
                          isExpense: true
                        })),
                      ...rawPayments
                        .filter(payment => 
                          (!startDate || payment.payment_date >= startDate) &&
                          (!endDate || payment.payment_date <= endDate) &&
                          (!searchTerm || (payment.description || '').toLowerCase().includes(searchTerm.toLowerCase()))
                        )
                        .map(payment => ({
                          date: payment.payment_date,
                          description: payment.description || 'Payment',
                          type: 'Payment',
                          amount: payment.amount,
                          id: payment.id,
                          isExpense: false
                        }))
                    ]
                    .sort((a, b) => sortAscending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))
                    .reduce((acc, item, index) => {
                      const runningBalance = index === 0 
                        ? item.amount 
                        : acc[index - 1].runningBalance + item.amount;
                      return [...acc, { ...item, runningBalance }];
                    }, [] as Array<any>)
                    .map((item, idx) => (
                      <tr key={`${item.type}-${idx}`} className="border-t">
                        <td className="px-4 py-2">
                          {isAdmin && item.id ? (
                            <Link 
                              href={`/edit-${item.isExpense ? 'expense' : 'payment'}/${item.id}`} 
                              className="text-blue-600 hover:underline"
                            >
                              {item.date}
                            </Link>
                          ) : (
                            item.date
                          )}
                        </td>
                        <td className="px-4 py-2">{item.description}</td>
                        <td className="px-4 py-2">{item.type}</td>
                        <td className={`px-4 py-2 text-right ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                        </td>
                        <td className={`px-4 py-2 text-right ${item.runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.runningBalance.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-bold">
                      <td className="px-4 py-2" colSpan={3}>Final Balance</td>
                      <td className={`px-4 py-2 text-right ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {balance.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function StatementsPage() {
  return (
    <Suspense fallback={<div className="p-6"><Header /><div>Loading...</div></div>}>
      <StatementsContent />
    </Suspense>
  )
}