"use client"

import { useEffect, useState, Suspense, useMemo, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import EmptyState from "@/components/EmptyState"
import Alert from "@/components/Alert"
import { Button } from "@/components/ui/button"
import { formatDisplayDate, formatMoney } from "@/lib/format"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { useAuth } from "@/context/AuthContext"
import Link from "next/link"
import { generateStatementPDF } from "../utils/generateStatementPDF"
import DocumentModal, { ElectricityBillInfo } from "@/components/DocumentModal"
import { Paperclip } from "lucide-react"

function parseSynergyAccount(description: string): string | null {
  const match = description.match(/Synergy bill for\s+(\d+)/i)
  return match?.[1] ?? null
}

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

interface Transaction {
  date: string
  description: string
  type: 'Expense' | 'Payment'
  amount: number
  id: string
  isExpense: boolean
  party_id?: string
  party_name?: string
  runningBalance?: number
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
  const { supabase, session, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [parties, setParties] = useState<Party[]>([])
  const [partyId, setPartyId] = useState(() => searchParams.get('party') || "")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [rawExpenses, setRawExpenses] = useState<ExpenseAllocation[]>([])
  const [rawPayments, setRawPayments] = useState<Payment[]>([])
  const [error, setError] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortAscending, setSortAscending] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({})
  const [electricityBillsByExpense, setElectricityBillsByExpense] = useState<Record<string, ElectricityBillInfo>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [modalExpenseId, setModalExpenseId] = useState<string | undefined>()
  const [modalPaymentId, setModalPaymentId] = useState<string | undefined>()
  const [modalDescription, setModalDescription] = useState<string>("")
  const [modalElectricityBill, setModalElectricityBill] = useState<ElectricityBillInfo | null>(null)
  const attachmentsTableMissing = useRef(false)
  const loadRequestId = useRef(0)

  // Reset pagination when filters/sort/search change
  useEffect(() => {
    setCurrentPage(1)
  }, [startDate, endDate, searchTerm, sortAscending, partyId])

  const handlePartyChange = (newPartyId: string) => {
    setPartyId(newPartyId)
    const params = new URLSearchParams(searchParams.toString())
    if (newPartyId) {
      params.set('party', newPartyId)
    } else {
      params.delete('party')
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  // Build filtered + sorted transactions with running balance or party info
  const computedTransactions = useMemo(() => {
    const combined: Transaction[] = [
      ...rawExpenses
        .filter(expense => 
          expense.expenses &&
          (!startDate || expense.expenses.expense_date >= startDate) &&
          (!endDate || expense.expenses.expense_date <= endDate) &&
          (!searchTerm || expense.expenses.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .map(expense => {
          const party = parties.find(p => p.id === expense.party_id)
          return {
            date: expense.expenses.expense_date,
            description: expense.expenses.description,
            type: 'Expense' as const,
            amount: -expense.allocated_amount,
            id: expense.expenses.id,
            isExpense: true,
            party_id: expense.party_id,
            party_name: party?.name
          }
        }),
      ...rawPayments
        .filter(payment => 
          (!startDate || payment.payment_date >= startDate) &&
          (!endDate || payment.payment_date <= endDate) &&
          (!searchTerm || (payment.description || '').toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .map(payment => {
          const party = parties.find(p => p.id === payment.party_id)
          return {
            date: payment.payment_date,
            description: payment.description || 'Payment',
            type: 'Payment' as const,
            amount: payment.amount,
            id: payment.id,
            isExpense: false,
            party_id: payment.party_id,
            party_name: party?.name
          }
        })
    ].sort((a, b) => sortAscending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))

    // Calculate running balance only if a party is selected
    if (partyId) {
      const withRunning = combined.reduce((acc, item, index, array) => {
        let runningBalance
        if (sortAscending) {
          runningBalance = index === 0 ? item.amount : acc[index - 1].runningBalance! + item.amount
        } else {
          const totalBalance = array.reduce((sum, t) => sum + t.amount, 0)
          runningBalance = totalBalance - array.slice(0, index).reduce((sum, t) => sum + t.amount, 0)
        }
        return [...acc, { ...item, runningBalance }]
      }, [] as Transaction[])
      return withRunning
    }

    return combined
  }, [rawExpenses, rawPayments, startDate, endDate, searchTerm, sortAscending, partyId, parties])

  // Pagination calculations
  const totalRows = computedTransactions.length
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage))
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows)
  const paginatedTransactions = computedTransactions.slice(startIndex, endIndex)
  const pageTransactionIds = useMemo(
    () => paginatedTransactions.map(t => `${t.isExpense ? "e" : "p"}:${t.id}`).join(","),
    [paginatedTransactions]
  )

  useEffect(() => { 
    if (!authLoading && session?.user) {
      loadParties() 
    }
  }, [authLoading, session])
  
  // Keep party filter in sync with ?party= URL (e.g. links from party names)
  useEffect(() => {
    setPartyId(searchParams.get('party') || "")
  }, [searchParams])

  useEffect(() => {
    if (authLoading || !session?.user) return

    const requestId = ++loadRequestId.current
    if (partyId) {
      loadStatementsForParty(partyId, requestId)
    } else {
      loadAllTransactions(requestId)
    }
  }, [partyId, authLoading, session])

  // Load attachment counts + Synergy bill matches for visible page only
  useEffect(() => {
    if (!pageTransactionIds) return
    if (!attachmentsTableMissing.current) {
      loadAttachmentCounts(paginatedTransactions)
    }
    loadElectricityBillMatches(paginatedTransactions)
  }, [pageTransactionIds])

  useEffect(() => {
    if (!authLoading && session?.user) {
      checkAdminStatus()
    } else {
      setIsAdmin(false)
    }
  }, [session, authLoading])

  // Add debug logging for isAdmin changes
  useEffect(() => {
    console.log('isAdmin state changed:', isAdmin)
  }, [isAdmin])

  const checkAdminStatus = async () => {
    if (!session?.user?.id) {
      console.log('No user session')
      setIsAdmin(false)
      return
    }
    
    try {
      console.log('Checking admin status for user:', session.user.id)
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
        return
      }

      if (!data) {
        console.log('No role found for user, defaulting to non-admin')
        setIsAdmin(false)
        return
      }

      const isUserAdmin = data.role === 'admin'
      console.log('Admin status check result:', { isUserAdmin, roleData: data })
      setIsAdmin(isUserAdmin)
    } catch (err) {
      console.error('Error checking admin status:', err)
      setIsAdmin(false)
    }
  }

  const loadParties = async () => {
    try {
      const { data, error } = await supabase.from("parties").select("*")
      if (error) {
        console.error('Error loading parties:', error)
        setError(error.message)
        return
      }
      setParties(data)
    } catch (err) {
      console.error('Error in loadParties:', err)
      setError('Failed to load parties')
    }
  }

  const loadStatementsForParty = async (selectedPartyId: string, requestId: number) => {
    try {
      setError('')
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
          .eq("party_id", selectedPartyId),
        supabase
          .from("payments")
          .select("*")
          .eq("party_id", selectedPartyId)
          .order("payment_date", { ascending: true })
      ])

      if (requestId !== loadRequestId.current) return

      if (expensesResponse.error) {
        console.error('Expenses error:', expensesResponse.error)
        setError(expensesResponse.error.message)
        return
      }

      if (paymentsResponse.error) {
        console.error('Payments error:', paymentsResponse.error)
        setError(paymentsResponse.error.message)
        return
      }

      console.log('Data loaded:', {
        expenses: expensesResponse.data,
        payments: paymentsResponse.data
      })
      
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
      setRawPayments(paymentsResponse.data)
    } catch (err) {
      console.error('Error in loadStatementsForParty:', err)
      if (requestId === loadRequestId.current) {
        setError('Failed to load statements')
      }
    }
  }

  const loadAllTransactions = async (requestId: number) => {
    try {
      setError('')
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
          `),
        supabase
          .from("payments")
          .select("*")
          .order("payment_date", { ascending: true })
      ])

      if (requestId !== loadRequestId.current) return

      if (expensesResponse.error) {
        console.error('Expenses error:', expensesResponse.error)
        setError(expensesResponse.error.message)
        return
      }

      if (paymentsResponse.error) {
        console.error('Payments error:', paymentsResponse.error)
        setError(paymentsResponse.error.message)
        return
      }

      console.log('All transactions loaded:', {
        expenses: expensesResponse.data,
        payments: paymentsResponse.data
      })
      
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
      setRawPayments(paymentsResponse.data)
    } catch (err) {
      console.error('Error in loadAllTransactions:', err)
      if (requestId === loadRequestId.current) {
        setError('Failed to load transactions')
      }
    }
  }

  const loadAttachmentCounts = async (transactions: Transaction[]) => {
    if (attachmentsTableMissing.current || transactions.length === 0) return

    const CHUNK_SIZE = 50
    const chunkIds = (ids: string[]) => {
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        chunks.push(ids.slice(i, i + CHUNK_SIZE))
      }
      return chunks
    }

    const isMissingTableError = (error: { code?: string; message?: string } | null) =>
      error?.code === "PGRST205" ||
      error?.code === "42P01" ||
      (error?.message?.includes("document_attachments") ?? false)

    try {
      const expenseIds = [...new Set(transactions.filter(t => t.isExpense).map(t => t.id))]
      const paymentIds = [...new Set(transactions.filter(t => !t.isExpense).map(t => t.id))]
      const counts: Record<string, number> = {}

      for (const chunk of chunkIds(expenseIds)) {
        const { data, error } = await supabase
          .from("document_attachments")
          .select("expense_id")
          .in("expense_id", chunk)

        if (error) {
          if (isMissingTableError(error)) {
            attachmentsTableMissing.current = true
          }
          return
        }

        data?.forEach(att => {
          if (att.expense_id) {
            counts[`expense_${att.expense_id}`] = (counts[`expense_${att.expense_id}`] || 0) + 1
          }
        })
      }

      for (const chunk of chunkIds(paymentIds)) {
        const { data, error } = await supabase
          .from("document_attachments")
          .select("payment_id")
          .in("payment_id", chunk)

        if (error) {
          if (isMissingTableError(error)) {
            attachmentsTableMissing.current = true
          }
          return
        }

        data?.forEach(att => {
          if (att.payment_id) {
            counts[`payment_${att.payment_id}`] = (counts[`payment_${att.payment_id}`] || 0) + 1
          }
        })
      }

      setAttachmentCounts(prev => ({ ...prev, ...counts }))
    } catch {
      // Attachment counts are optional; fail silently
    }
  }

  const loadElectricityBillMatches = async (transactions: Transaction[]) => {
    const synergyExpenses = transactions.filter(
      t => t.isExpense && parseSynergyAccount(t.description)
    )
    if (synergyExpenses.length === 0) return

    const accountNumbers = [
      ...new Set(
        synergyExpenses
          .map(t => parseSynergyAccount(t.description))
          .filter((a): a is string => !!a)
      ),
    ]

    const expenseAmountById: Record<string, number> = {}
    rawExpenses.forEach(alloc => {
      if (alloc.expenses?.id) {
        expenseAmountById[alloc.expenses.id] = Number(alloc.expenses.amount)
      }
    })

    try {
      const { data, error } = await supabase
        .from("electricity_bills")
        .select(
          "id, bill_date, bill_date_range_start, bill_date_range_end, total_units_consumed, units_per_day, is_estimated, account_number, bill_amount, meter_reading, pdf_file_path"
        )
        .in("account_number", accountNumbers)

      if (error || !data) return

      const matches: Record<string, ElectricityBillInfo> = {}

      for (const expense of synergyExpenses) {
        const account = parseSynergyAccount(expense.description)
        if (!account) continue

        const candidates = data.filter(b => b.account_number === account)
        if (candidates.length === 0) continue

        const fullAmount = expenseAmountById[expense.id]
        const byDate = candidates.find(b => b.bill_date === expense.date)
        const byAmount =
          fullAmount != null
            ? candidates.find(b => Math.abs(Number(b.bill_amount) - fullAmount) < 0.02)
            : undefined

        let byNearbyDate: ElectricityBillInfo | undefined
        if (!byDate && !byAmount) {
          const expenseTime = new Date(expense.date + "T00:00:00").getTime()
          const nearby = candidates
            .map(b => ({
              bill: b as ElectricityBillInfo,
              diff: Math.abs(new Date(b.bill_date + "T00:00:00").getTime() - expenseTime),
            }))
            .filter(x => x.diff <= 30 * 24 * 60 * 60 * 1000)
            .sort((a, b) => a.diff - b.diff)
          byNearbyDate = nearby[0]?.bill
        }

        const match = byDate || byAmount || byNearbyDate
        if (match) {
          matches[expense.id] = match as ElectricityBillInfo
        }
      }

      setElectricityBillsByExpense(prev => ({ ...prev, ...matches }))
    } catch {
      // Electricity bill matching is optional; fail silently
    }
  }

  const openDocumentModal = (transaction: Transaction) => {
    if (transaction.isExpense) {
      setModalExpenseId(transaction.id)
      setModalPaymentId(undefined)
      setModalElectricityBill(electricityBillsByExpense[transaction.id] || null)
    } else {
      setModalPaymentId(transaction.id)
      setModalExpenseId(undefined)
      setModalElectricityBill(null)
    }
    setModalDescription(transaction.description)
    setModalOpen(true)
  }

  const getAttachmentCount = (transaction: Transaction): number => {
    const key = transaction.isExpense 
      ? `expense_${transaction.id}`
      : `payment_${transaction.id}`
    return attachmentCounts[key] || 0
  }

  const hasDocumentLink = (transaction: Transaction): boolean => {
    if (getAttachmentCount(transaction) > 0) return true
    if (transaction.isExpense && electricityBillsByExpense[transaction.id]) return true
    return false
  }

  const getDocumentCount = (transaction: Transaction): number => {
    const attachments = getAttachmentCount(transaction)
    const hasBill = transaction.isExpense && electricityBillsByExpense[transaction.id] ? 1 : 0
    return attachments + hasBill
  }

  const generatePDF = async () => {
    const party = parties.find(p => p.id === partyId)
    
    // Convert logo to base64
    let logoBase64 = ''
    try {
      const response = await fetch(`/icon-512-statement.png?v=${Date.now()}`)
      const blob = await response.blob()
      const reader = new FileReader()
      logoBase64 = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.warn('Failed to load logo for PDF:', error)
    }
    
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

    // Generate PDF using shared function
    const doc = generateStatementPDF({
      partyName: party?.name || '',
      closingBalance: balance,
      transactions,
      logoImage: logoBase64
    })

    // Save PDF
    const blob = new Blob([doc], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `statement_${party?.name}_${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const generateCSV = () => {
    const party = parties.find(p => p.id === partyId)
    const headers = partyId 
      ? "Date,Description,Type,Amount,Balance\n"
      : "Date,Description,Type,Party,Amount\n"
    let csvContent = headers
    
    const transactions = computedTransactions.map(item => ({
      date: item.date,
      description: item.description,
      type: item.type,
      party: item.party_name || '',
      amount: item.amount
    }))
    
    if (partyId) {
      // Calculate running balance for party view
      let runningBalance = 0
      transactions.forEach(item => {
        runningBalance += item.amount
        csvContent += `${item.date},"${item.description}",${item.type},${item.amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })},${runningBalance.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}\n`
      })
    } else {
      // No balance for all transactions view
      transactions.forEach(item => {
        csvContent += `${item.date},"${item.description}",${item.type},"${item.party}",${item.amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}\n`
      })
    }
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      const filename = partyId 
        ? `statement_${party?.name}_${new Date().toISOString().split('T')[0]}.csv`
        : `all_transactions_${new Date().toISOString().split('T')[0]}.csv`
      link.setAttribute("download", filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Calculate total balance (only when a party is selected)
  const balance = partyId 
    ? rawPayments.reduce((sum, p) => sum + p.amount, 0) - rawExpenses.reduce((sum, e) => sum + e.allocated_amount, 0)
    : 0

  return (
    <AppShell>
      <PageFrame
        title="Statements"
        description="Payments increase a balance. Expenses reduce it. Export is available once a party is selected."
      >
      {error && <Alert tone="error">{error}</Alert>}

      {authLoading ? (
        <EmptyState title="Loading statements" />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Party</label>
                <select 
                  value={partyId} 
                  onChange={(e) => handlePartyChange(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          {(partyId || computedTransactions.length > 0) && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">
                  {partyId ? 'Statement Details' : 'All Transactions'}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => generatePDF()}
                    disabled={!partyId}
                    title={partyId ? "Download a PDF statement" : "Select a party to export"}
                  >
                    Export PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateCSV}
                    disabled={!partyId}
                    title={partyId ? "Download a CSV statement" : "Select a party to export"}
                  >
                    Export CSV
                  </Button>
                  {!partyId ? <span className="text-sm text-gray-500">Select a party to export.</span> : null}
                </div>
              </div>

              <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr>
                      <th className="sticky left-0 z-20 bg-white px-4 py-2 text-left">
                        <div className="flex items-center gap-2">
                          Date
                          <button
                            type="button"
                            onClick={() => setSortAscending(!sortAscending)}
                            className="rounded px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={sortAscending ? "Showing oldest first. Show newest first." : "Showing newest first. Show oldest first."}
                          >
                            {sortAscending ? "Oldest first" : "Newest first"}
                          </button>
                        </div>
                      </th>
                      <th className="px-4 py-2 text-left">Description</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      {!partyId && <th className="px-4 py-2 text-left">Party</th>}
                      <th className="px-4 py-2 text-right">Amount</th>
                      {partyId && <th className="px-4 py-2 text-right">Balance</th>}
                      <th className="px-4 py-2 text-center">Documents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={partyId ? 6 : 6} className="px-4 py-8 text-center text-gray-500">
                          {partyId ? 'No transactions found for this party' : 'No transactions found'}
                        </td>
                      </tr>
                    ) : (
                      paginatedTransactions.map((item, idx) => (
                        <tr key={`${item.type}-${item.id}-${idx}`} className="border-t hover:bg-gray-50">
                          <td className="sticky left-0 bg-white px-4 py-2">
                            {isAdmin && item.id ? (
                              <Link 
                                href={`/edit-${item.isExpense ? 'expense' : 'payment'}/${item.id}`} 
                                className="text-green-800 underline-offset-2 hover:underline"
                              >
                                {formatDisplayDate(item.date)}
                              </Link>
                            ) : (
                              formatDisplayDate(item.date)
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {hasDocumentLink(item) ? (
                              <button
                                type="button"
                                onClick={() => openDocumentModal(item)}
                                className="text-left text-green-800 underline-offset-2 hover:underline"
                                title="View attached document(s)"
                              >
                                {item.description}
                              </button>
                            ) : (
                              item.description
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${item.isExpense ? "bg-gray-100 text-gray-700" : "bg-green-50 text-green-800"}`}>
                              {item.type}
                            </span>
                          </td>
                        {!partyId && (
                          <td className="px-4 py-2">
                            {item.party_name ? (
                              <Link 
                                href={`/statements?party=${item.party_id}`}
                                className="text-green-800 underline-offset-2 hover:underline"
                              >
                                {item.party_name}
                              </Link>
                            ) : (
                              'Unknown'
                            )}
                          </td>
                        )}
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(item.amount)}
                        </td>
                        {partyId && (
                          <td className="px-4 py-2 text-right tabular-nums">
                            {formatMoney(item.runningBalance!)}
                          </td>
                        )}
                        <td className="px-4 py-2 text-center">
                          {getDocumentCount(item) > 0 && (
                            <button
                              onClick={() => openDocumentModal(item)}
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center justify-center gap-1"
                              title={`${getDocumentCount(item)} document(s) attached`}
                            >
                              <Paperclip className="w-4 h-4" />
                              <span className="text-xs">{getDocumentCount(item)}</span>
                            </button>
                          )}
                        </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {partyId && (
                    <tfoot>
                      <tr className="border-t font-bold">
                        <td className="px-4 py-2" colSpan={3}>Final Balance</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(balance)}
                        </td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 border-t-0 rounded-b">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="border rounded px-2 py-1 text-sm bg-white"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {totalRows === 0 ? '0-0 of 0' : `${startIndex + 1}-${endIndex} of ${totalRows}`}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`border rounded px-2 py-1 text-sm ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white'}`}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`border rounded px-2 py-1 text-sm ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <DocumentModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setModalExpenseId(undefined)
          setModalPaymentId(undefined)
          setModalDescription("")
          setModalElectricityBill(null)
        }}
        expenseId={modalExpenseId}
        paymentId={modalPaymentId}
        transactionDescription={modalDescription}
        electricityBill={modalElectricityBill}
      />
      </PageFrame>
    </AppShell>
  )
}

export default function StatementsPage() {
  return (
    <Suspense fallback={<AppShell><EmptyState title="Loading statements" /></AppShell>}>
      <StatementsContent />
    </Suspense>
  )
}