'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import AppShell from '@/components/AppShell'
import PageFrame from '@/components/PageFrame'
import EmptyState from '@/components/EmptyState'
import Alert from '@/components/Alert'
import { fieldControlClass } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { ElectricityBillData } from '@/lib/parseElectricityBill'
import { formatDisplayDate, formatMoney } from '@/lib/format'

interface ElectricityBill {
  id: string
  bill_date: string
  bill_date_range_start: string
  bill_date_range_end: string
  total_units_consumed: number
  units_per_day?: number | null
  is_estimated: boolean
  account_number: string
  bill_amount: number
  meter_reading?: number | null
  pdf_file_path?: string
  expense_id?: string | null
  created_at: string
  updated_at: string
}

interface Party {
  id: string
  name: string
  electricity_account_number?: string | null
}

export default function ElectricityBillsPage() {
  const { supabase, session, loading: authLoading } = useAuth()
  const [bills, setBills] = useState<ElectricityBill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [parsingResults, setParsingResults] = useState<Array<ElectricityBillData & {fileName: string, fileUrl: string}>>([])
  const [failedFiles, setFailedFiles] = useState<Array<{fileName: string, error: string}>>([])
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [sortAscending, setSortAscending] = useState(false)
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set())
  const [selectedParsedBills, setSelectedParsedBills] = useState<Set<number>>(new Set())
  const [failedImports, setFailedImports] = useState<Map<number, string>>(new Map())
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number, currentFile: string} | null>(null)
  const [saveProgress, setSaveProgress] = useState<{current: number, total: number, currentFile: string} | null>(null)
  const [selectedAccountNumber, setSelectedAccountNumber] = useState<string>('')
  const [parties, setParties] = useState<Party[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (session) {
      checkAdminStatus()
      loadBills()
      loadParties()
    }
  }, [session])

  useEffect(() => {
    if (session) {
      loadBills()
    }
  }, [sortAscending])

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      parsingResults.forEach(result => {
        URL.revokeObjectURL(result.fileUrl)
      })
    }
  }, [parsingResults])

  const checkAdminStatus = async () => {
    try {
      const { data: userRole, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session?.user.id)
        .single()

      if (!error && userRole?.role === 'admin') {
        setIsAdmin(true)
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
    }
  }

  const loadBills = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('electricity_bills')
        .select('*')
        .order('bill_date_range_start', { ascending: sortAscending })

      if (error) throw error
      setBills(data || [])
    } catch (error) {
      console.error('Error loading bills:', error)
      setError('Failed to load electricity bills')
    } finally {
      setLoading(false)
    }
  }

  const loadParties = async () => {
    try {
      const { data, error } = await supabase
        .from('parties')
        .select('id, name, electricity_account_number')
        .not('electricity_account_number', 'is', null)

      if (error) throw error
      setParties(data || [])
    } catch (error) {
      console.error('Error loading parties:', error)
    }
  }

  // Get unique account numbers from bills with party names
  const getAccountNumbersWithParties = () => {
    const accountNumbers = [...new Set(bills.map(bill => bill.account_number))]
    return accountNumbers
      .map(accountNumber => {
        const party = parties.find(p => p.electricity_account_number === accountNumber)
        return {
          accountNumber,
          partyName: party?.name || 'Unknown Party'
        }
      })
      .sort((a, b) => a.partyName.localeCompare(b.partyName))
  }

  // Filter bills based on selected account number
  const filteredBills = selectedAccountNumber
    ? bills.filter(bill => bill.account_number === selectedAccountNumber)
    : bills

  // Pagination logic
  const totalPages = Math.ceil(filteredBills.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedBills = filteredBills.slice(startIndex, endIndex)

  // Reset to first page and clear selections when account number changes
  useEffect(() => {
    setCurrentPage(1)
    setSelectedBills(new Set())
  }, [selectedAccountNumber])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await processUploadedFiles(files)
  }

  const handleDroppedFiles = (fileList: FileList) => {
    const input = fileInputRef.current
    if (!input || fileList.length === 0) return
    const transfer = new DataTransfer()
    Array.from(fileList).forEach((file) => transfer.items.add(file))
    input.files = transfer.files
    void processUploadedFiles(input.files)
  }

  const processUploadedFiles = async (files: FileList) => {

    setUploading(true)
    setError('')
    setNotice('')
    setParsingResults([])
    setFailedFiles([])
    setUploadProgress({ current: 0, total: files.length, currentFile: '' })

    try {
      const results: Array<ElectricityBillData & { fileName: string; fileUrl: string }> = []
      const failures: Array<{fileName: string, error: string}> = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress({ current: i + 1, total: files.length, currentFile: file.name })
        
        if (file.type !== 'application/pdf') {
          failures.push({
            fileName: file.name,
            error: 'File is not a PDF'
          })
          continue
        }

        try {
          const formData = new FormData()
          formData.append('file', file)
          
          console.log(`Sending file ${file.name} (${file.size} bytes, type: ${file.type}) to parse-electricity-bill API`)

          const response = await fetch('/api/parse-electricity-bill', {
            method: 'POST',
            body: formData,
          })

          const data = await response.json()

          if (!response.ok) {
            const errorMessage = data.error || `HTTP ${response.status}: ${response.statusText}`
            console.error(`Failed to parse ${file.name}:`, errorMessage)
            failures.push({
              fileName: file.name,
              error: errorMessage
            })
            continue
          }

          // Create object URL for the file
          const fileUrl = URL.createObjectURL(file)
          
          console.log('Received parsed data for', file.name, ':', JSON.stringify(data.data, null, 2));
          results.push({
            ...data.data,
            fileName: file.name,
            fileUrl: fileUrl
          })
        } catch (err) {
          failures.push({
            fileName: file.name,
            error: err instanceof Error ? err.message : 'Network or processing error'
          })
        }
      }

      setParsingResults(results)
      setFailedFiles(failures)
      
      // Show upload form if we have any successful results
      if (results.length > 0) {
        setShowUploadForm(true)
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process files')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  const handleSaveBills = async () => {
    try {
      setUploading(true)
      setError('')
      setNotice('')
      setFailedImports(new Map()) // Reset failed imports
      
      // Only save selected bills
      const selectedIndices = parsingResults
        .map((_, index) => index)
        .filter((index) => selectedParsedBills.has(index))
      
      if (selectedIndices.length === 0) {
        setError('No bills selected for saving')
        return
      }
      
      setSaveProgress({ current: 0, total: selectedIndices.length, currentFile: '' })
      
      const failedImportsMap = new Map<number, string>()
      const successfulIndices: number[] = []
      const outcomes = { created: 0, linked: 0, already_recorded: 0 }
      
      for (let step = 0; step < selectedIndices.length; step++) {
        const i = selectedIndices[step]
        const billData = parsingResults[i]
        setSaveProgress({ current: step + 1, total: selectedIndices.length, currentFile: billData.fileName })
        try {
          const response = await fetch('/api/electricity-bills', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              billDate: billData.billDate,
              billDateRangeStart: billData.billDateRangeStart,
              billDateRangeEnd: billData.billDateRangeEnd,
              totalUnitsConsumed: billData.totalUnitsConsumed,
              unitsPerDay: billData.unitsPerDay,
              isEstimated: billData.isEstimated,
              accountNumber: billData.accountNumber,
              billAmount: billData.billAmount,
              meterReading: billData.meterReading,
            }),
          })

          const data = await response.json()

          if (!response.ok) {
            const errorMessage = data.error || 'Unknown error occurred'
            failedImportsMap.set(i, errorMessage)
            console.error(`Failed to save bill ${i}:`, errorMessage)
          } else {
            successfulIndices.push(i)
            if (data.expenseStatus === 'created' || data.expenseStatus === 'linked' || data.expenseStatus === 'already_recorded') {
              outcomes[data.expenseStatus as keyof typeof outcomes] += 1
            }
            console.log(`Successfully saved bill ${i}:`, data.expenseStatus)
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Network or processing error'
          failedImportsMap.set(i, errorMessage)
          console.error(`Failed to save bill ${i}:`, errorMessage)
        }
      }

      // Update failed imports state
      setFailedImports(failedImportsMap)
      
      // Remove successfully imported bills from the list
      const remainingBills = parsingResults.filter((_, index) => !successfulIndices.includes(index))
      const remainingSelectedBills = new Set<number>()
      
      // Update selected bills indices for remaining bills
      selectedParsedBills.forEach(selectedIndex => {
        if (!successfulIndices.includes(selectedIndex)) {
          // Find the new index in the remaining bills array
          const newIndex = remainingBills.findIndex((_, i) => {
            const originalIndex = parsingResults.findIndex((_, j) => !successfulIndices.includes(j) && j === selectedIndex)
            return i === originalIndex
          })
          if (newIndex !== -1) {
            remainingSelectedBills.add(newIndex)
          }
        }
      })
      
      // Update failed imports indices for remaining bills
      const updatedFailedImports = new Map<number, string>()
      failedImportsMap.forEach((errorMessage, originalIndex) => {
        if (!successfulIndices.includes(originalIndex)) {
          const newIndex = remainingBills.findIndex((_, i) => {
            const originalIndexInRemaining = parsingResults.findIndex((_, j) => !successfulIndices.includes(j) && j === originalIndex)
            return i === originalIndexInRemaining
          })
          if (newIndex !== -1) {
            updatedFailedImports.set(newIndex, errorMessage)
          }
        }
      })
      
      // Update state with remaining bills
      setParsingResults(remainingBills)
      setSelectedParsedBills(remainingSelectedBills)
      setFailedImports(updatedFailedImports)
      
      const outcomeParts = []
      if (outcomes.created > 0) {
        outcomeParts.push(`${outcomes.created} new expense${outcomes.created === 1 ? '' : 's'} recorded`)
      }
      if (outcomes.linked > 0) {
        outcomeParts.push(`${outcomes.linked} linked to an existing expense`)
      }
      if (outcomes.already_recorded > 0) {
        outcomeParts.push(`${outcomes.already_recorded} already in the cashbook`)
      }
      const savedSummary = successfulIndices.length > 0
        ? `${successfulIndices.length} bill${successfulIndices.length === 1 ? '' : 's'} saved${outcomeParts.length ? `. ${outcomeParts.join(', ')}` : ''}.`
        : ''

      // Check if any bills failed
      if (failedImportsMap.size > 0) {
        if (savedSummary) {
          setNotice(savedSummary)
        }
        if (successfulIndices.length > 0) {
          setError(`${failedImportsMap.size} bill${failedImportsMap.size === 1 ? '' : 's'} failed to import. Check the highlighted bills below.`)
        } else {
          setError(`All ${failedImportsMap.size} selected bills failed to import. Check the highlighted bills below.`)
        }
        
        // Reload bills to show any successful imports
        await loadBills()
      } else {
        // All bills saved successfully
        await loadBills()
        // Clean up object URLs to prevent memory leaks
        parsingResults.forEach(result => {
          URL.revokeObjectURL(result.fileUrl)
        })
        setParsingResults([])
        setSelectedParsedBills(new Set())
        setFailedImports(new Map())
        setFailedFiles([])
        setShowUploadForm(false)
        setError('')
        setNotice(savedSummary)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bills')
    } finally {
      setUploading(false)
      setSaveProgress(null)
    }
  }

  const handleCancelUpload = () => {
    // Clean up object URLs to prevent memory leaks
    parsingResults.forEach(result => {
      URL.revokeObjectURL(result.fileUrl)
    })
    setParsingResults([])
    setSelectedParsedBills(new Set())
    setFailedImports(new Map())
    setFailedFiles([])
    setShowUploadForm(false)
    setError('')
    setNotice('')
    setUploadProgress(null)
    setSaveProgress(null)
  }

  const handleSelectBill = (billId: string, checked: boolean) => {
    const newSelected = new Set(selectedBills)
    if (checked) {
      newSelected.add(billId)
    } else {
      newSelected.delete(billId)
    }
    setSelectedBills(newSelected)
  }

  const handleSelectParsedBill = (index: number, checked: boolean) => {
    if (checked) {
      setSelectedParsedBills(prev => new Set([...prev, index]))
    } else {
      setSelectedParsedBills(prev => {
        const newSet = new Set(prev)
        newSet.delete(index)
        return newSet
      })
    }
  }

  const handleSelectAllParsedBills = () => {
    if (selectedParsedBills.size === parsingResults.length) {
      setSelectedParsedBills(new Set())
    } else {
      setSelectedParsedBills(new Set(parsingResults.map((_, index) => index)))
    }
  }

  const handleSelectAll = () => {
    if (selectedBills.size === paginatedBills.length) {
      // If all paginated are selected, deselect all
      setSelectedBills(new Set())
    } else {
      // Select all paginated bills
      setSelectedBills(new Set(paginatedBills.map(bill => bill.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedBills.size === 0) {
      setError('No bills selected for deletion')
      return
    }

    if (!confirm(`Delete ${selectedBills.size} selected bill(s)? The cashbook expense for each bill is kept.`)) {
      return
    }

    try {
      setLoading(true)
      setError('')

      // Delete all selected bills
      for (const billId of selectedBills) {
        const response = await fetch(`/api/electricity-bills?id=${billId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(`Failed to delete bill ${billId}: ${errorData.error}`)
        }
      }

      // Clear selection and reload bills
      setSelectedBills(new Set())
      await loadBills()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete selected bills')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => formatDisplayDate(dateString)
  const formatCurrency = (amount: number) => formatMoney(amount)

  const calculateDaysInRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (authLoading) {
    return (
      <AppShell>
        <EmptyState title="Loading bills" />
      </AppShell>
    )
  }

  if (!session) {
    return (
      <AppShell>
        <EmptyState
          title="Sign in to view electricity bills"
          action={<Link href="/login" className="text-sm font-medium text-green-800 underline">Sign in</Link>}
        />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageFrame
        title="Electricity bills"
        description="Upload a Synergy PDF to record the bill and post the expense. Saving a bill that is already paid links the existing expense."
      >

          {notice ? <Alert tone="success">{notice}</Alert> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}

          {isAdmin && (
            <div className="mb-8 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Upload bills</h2>
              
              {!showUploadForm ? (
                <div>
                  <label
                    className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center hover:border-green-700"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      if (event.dataTransfer.files.length > 0) handleDroppedFiles(event.dataTransfer.files)
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,application/pdf"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                    <span className="font-medium text-gray-900">Drop PDF bills here, or click to choose</span>
                    <span className="mt-1 max-w-xl text-sm text-gray-600">
                      Saving a bill records it here and posts the expense, split across the parties for that account.
                    </span>
                  </label>
                  
                  {/* Progress Indicator */}
                  {uploadProgress && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-900">Reading files</span>
                        <span className="text-gray-500">{uploadProgress.current} of {uploadProgress.total}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full bg-primary transition-[width] duration-300"
                          style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{uploadProgress.currentFile}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="font-medium text-gray-900">{parsingResults.length} parsed</span>
                      {failedFiles.length > 0 ? (
                        <span className="font-medium text-red-700">{failedFiles.length} failed</span>
                      ) : null}
                    </div>
                    <span className="text-gray-500">{parsingResults.length + failedFiles.length} files</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-gray-900">Parsed bills ({parsingResults.length})</h3>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedParsedBills.size === parsingResults.length && parsingResults.length > 0}
                        onChange={handleSelectAllParsedBills}
                      />
                      {selectedParsedBills.size === parsingResults.length && parsingResults.length > 0 ? "Deselect all" : "Select all"}
                      <span className="text-gray-500">
                        {selectedParsedBills.size > 0 ? `${selectedParsedBills.size} selected` : `${parsingResults.length} bills`}
                      </span>
                    </label>
                  </div>
                  
                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="w-full min-w-[48rem] text-sm">
                      <thead className="bg-gray-50 text-left">
                        <tr>
                          <th className="px-3 py-2"></th>
                          <th className="px-3 py-2 font-medium">Account</th>
                          <th className="px-3 py-2 font-medium">Bill date</th>
                          <th className="px-3 py-2 font-medium">Range</th>
                          <th className="px-3 py-2 text-right font-medium">kWh</th>
                          <th className="px-3 py-2 font-medium">Reading</th>
                          <th className="px-3 py-2 text-right font-medium">Amount</th>
                          <th className="px-3 py-2 font-medium">File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsingResults.map((bill, index) => (
                          <tr key={index} className={failedImports.has(index) ? "border-t bg-red-50" : "border-t"}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                aria-label={failedImports.has(index) ? "Retry this bill" : "Select this bill"}
                                checked={selectedParsedBills.has(index)}
                                onChange={(e) => handleSelectParsedBill(index, e.target.checked)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              {bill.accountNumber}
                              {failedImports.has(index) ? (
                                <div className="mt-1 text-xs text-red-700">Import failed: {failedImports.get(index)}</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">{formatDate(bill.billDate)}</td>
                            <td className="px-3 py-2">{formatDate(bill.billDateRangeStart)} – {formatDate(bill.billDateRangeEnd)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{bill.totalUnitsConsumed.toFixed(2)}</td>
                            <td className="px-3 py-2">{bill.isEstimated ? "Estimated" : "Actual"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(bill.billAmount)}</td>
                            <td className="px-3 py-2">
                              <a href={bill.fileUrl} target="_blank" rel="noopener noreferrer" className="text-green-800 underline-offset-2 hover:underline">
                                {bill.fileName}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Failed Files Section */}
                  {failedFiles.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <h4 className="mb-3 text-sm font-semibold text-red-800">Could not read {failedFiles.length} {failedFiles.length === 1 ? "file" : "files"}</h4>
                      <div className="space-y-2">
                        {failedFiles.map((failure, index) => (
                          <div key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm">
                            <span className="font-medium text-gray-900">{failure.fileName}</span>
                            <span className="text-red-700">{failure.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {saveProgress && (
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-900">Saving bills</span>
                        <span className="text-gray-500">{saveProgress.current} of {saveProgress.total}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full bg-primary transition-[width] duration-300"
                          style={{ width: `${(saveProgress.current / saveProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{saveProgress.currentFile}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button type="button" onClick={handleSaveBills} disabled={uploading || selectedParsedBills.size === 0}>
                      {uploading ? "Saving..." : `Save ${selectedParsedBills.size} selected`}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCancelUpload}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Bill history</h2>
                {!loading && bills.length > 0 && (
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedAccountNumber
                      ? `Showing ${filteredBills.length} bills for ${getAccountNumbersWithParties().find(a => a.accountNumber === selectedAccountNumber)?.partyName} (${selectedAccountNumber})`
                      : `Showing ${filteredBills.length} bills`}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  Account
                  <select
                    value={selectedAccountNumber}
                    onChange={(e) => setSelectedAccountNumber(e.target.value)}
                    className={fieldControlClass}
                  >
                    <option value="">All accounts</option>
                    {getAccountNumbersWithParties().map(({ accountNumber, partyName }) => (
                      <option key={accountNumber} value={accountNumber}>
                        {partyName} ({accountNumber})
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSortAscending(!sortAscending)}
                  aria-label={sortAscending ? "Showing oldest first. Show newest first." : "Showing newest first. Show oldest first."}
                >
                  {sortAscending ? "Oldest first" : "Newest first"}
                </Button>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Loading bills...</p>
            ) : bills.length === 0 ? (
              <EmptyState title="No electricity bills yet" description="Upload a bill above and it will appear here." />
            ) : filteredBills.length === 0 ? (
              <EmptyState title="No bills for this account" description="Choose another account, or show all accounts." />
            ) : (
              <>
                {/* Bulk Actions Toolbar */}
                {isAdmin && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-lg border border-b-0 border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-4">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedBills.size === paginatedBills.length && paginatedBills.length > 0}
                          onChange={handleSelectAll}
                        />
                        {selectedBills.size === paginatedBills.length && paginatedBills.length > 0 ? "Deselect page" : "Select page"}
                      </label>
                      <span className="text-sm text-gray-500">
                        {selectedBills.size > 0 ? `${selectedBills.size} of ${filteredBills.length} selected` : `${filteredBills.length} bills`}
                      </span>
                    </div>
                    {selectedBills.size > 0 && (
                      <Button type="button" variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={loading}>
                        Delete selected ({selectedBills.size})
                      </Button>
                    )}
                  </div>
                )}
                <div className={`max-h-[70vh] overflow-auto border border-gray-200 ${isAdmin ? "rounded-none" : "rounded-t-lg"}`}>
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b text-left text-xs font-medium text-gray-500">
                      {isAdmin && (
                        <th className="w-10 px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedBills.size === paginatedBills.length && paginatedBills.length > 0}
                            onChange={handleSelectAll}
                            aria-label="Select bills on this page"
                          />
                        </th>
                      )}
                      <th className="sticky left-0 z-20 bg-white px-3 py-2">Account</th>
                      <th className="px-3 py-2">Bill date</th>
                      <th className="px-3 py-2">Date range</th>
                      <th className="px-3 py-2 text-right">Days</th>
                      <th className="px-3 py-2 text-right">Units (kWh)</th>
                      <th className="px-3 py-2 text-right">Meter</th>
                      <th className="px-3 py-2 text-right">Units/day</th>
                      <th className="px-3 py-2">Reading</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Expense</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBills.map((bill) => (
                      <tr key={bill.id} className="group border-b border-gray-100 hover:bg-gray-50">
                        {isAdmin && (
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedBills.has(bill.id)}
                              onChange={(e) => handleSelectBill(bill.id, e.target.checked)}
                              aria-label={`Select bill ${bill.account_number} ${formatDate(bill.bill_date)}`}
                            />
                          </td>
                        )}
                        <td className="sticky left-0 bg-white px-3 py-2 font-medium text-gray-900 group-hover:bg-gray-50">{bill.account_number}</td>
                        <td className="whitespace-nowrap px-3 py-2">{formatDate(bill.bill_date)}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatDate(bill.bill_date_range_start)} – {formatDate(bill.bill_date_range_end)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {calculateDaysInRange(bill.bill_date_range_start, bill.bill_date_range_end)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{bill.total_units_consumed.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{bill.meter_reading ? bill.meter_reading.toFixed(2) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{bill.units_per_day ? bill.units_per_day.toFixed(4) : "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${bill.is_estimated ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
                            {bill.is_estimated ? "Estimated" : "Actual"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(bill.bill_amount)}</td>
                        <td className="px-3 py-2">
                          {bill.expense_id ? (
                            <Link href={`/edit-expense/${bill.expense_id}`} className="font-medium text-green-800 hover:underline">
                              Recorded
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {filteredBills.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-lg border border-t-0 border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Rows per page</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {startIndex + 1}-{Math.min(endIndex, filteredBills.length)} of {filteredBills.length}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                      Previous
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
      </PageFrame>
    </AppShell>
  )
}
