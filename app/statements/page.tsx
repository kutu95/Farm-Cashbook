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
          expenses:expense_id (
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
      // Sort expenses by date after fetching
      const sortedExpenses = (expensesResponse.data as unknown as ExpenseAllocation[]).sort((a, b) => {
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
    
    // Add title
    doc.text(`Statement for ${party?.name}`, 14, 15)
    
    // Add date range if specified
    if (startDate && endDate) {
      doc.text(`Period: ${startDate} to ${endDate}`, 14, 25)
    }

    // Prepare table data
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
    
    // Calculate running balance
    let runningBalance = 0
    const tableData = transactions.map(item => {
      runningBalance += item.amount
      return [
        item.date,
        item.description,
        item.type,
        item.amount.toFixed(2),
        runningBalance.toFixed(2)
      ]
    })
    
    // Add table
    autoTable(doc, {
      head: [['Date', 'Description', 'Type', 'Amount', 'Balance']],
      body: tableData,
      startY: 35,
      theme: 'grid'
    })
    
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
    .sort((a, b) => a.date.localeCompare(b.date))
    
    // Calculate running balance
    let runningBalance = 0
    transactions.forEach(item => {
      runningBalance += item.amount
      csvContent += `${item.date},"${item.description}",${item.type},${item.amount.toFixed(2)},${runningBalance.toFixed(2)}\n`
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
                      <th className="px-4 py-2 text-left">Date</th>
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
                    .sort((a, b) => a.date.localeCompare(b.date))
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
                          {item.amount.toFixed(2)}
                        </td>
                        <td className={`px-4 py-2 text-right ${item.runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.runningBalance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-bold">
                      <td className="px-4 py-2" colSpan={3}>Final Balance</td>
                      <td className={`px-4 py-2 text-right ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {balance.toFixed(2)}
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