'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import Header from '@/components/Header'
import DashboardShell from '@/components/DashboardShell'
import { ElectricityBillData } from '@/lib/parseElectricityBill'

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
  pdf_file_path?: string
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
    : []

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

    setUploading(true)
    setError('')
    setParsingResults([])
    setFailedFiles([])
    setUploadProgress({ current: 0, total: files.length, currentFile: '' })

    try {
      const results: ElectricityBillData[] = []
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
      setFailedImports(new Map()) // Reset failed imports
      
      // Only save selected bills
      const billsToSave = parsingResults.filter((_, index) => selectedParsedBills.has(index))
      
      if (billsToSave.length === 0) {
        setError('No bills selected for saving')
        return
      }
      
      setSaveProgress({ current: 0, total: billsToSave.length, currentFile: '' })
      
      const failedImportsMap = new Map<number, string>()
      const successfulIndices: number[] = []
      
      for (let i = 0; i < parsingResults.length; i++) {
        const billData = parsingResults[i]
        setSaveProgress({ current: successfulIndices.length + 1, total: billsToSave.length, currentFile: billData.fileName })
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

          if (!response.ok) {
            const errorData = await response.json()
            const errorMessage = errorData.error || 'Unknown error occurred'
            failedImportsMap.set(i, errorMessage)
            console.error(`Failed to save bill ${i}:`, errorMessage)
          } else {
            successfulIndices.push(i)
            console.log(`Successfully saved bill ${i}`)
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
      
      // Check if any bills failed
      if (failedImportsMap.size > 0) {
        const successCount = successfulIndices.length
        if (successCount > 0) {
          setError(`${successCount} bills saved successfully, ${failedImportsMap.size} bills failed to import. Check the highlighted bills below.`)
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

    if (!confirm(`Are you sure you want to delete ${selectedBills.size} selected bill(s)? This action cannot be undone.`)) {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount)
  }

  const calculateDaysInRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (authLoading) {
    return <div>Loading...</div>
  }

  if (!session) {
    return <div>Please log in to access this page.</div>
  }

  return (
    <div>
      <Header />
      <DashboardShell>
        <div style={{ padding: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
            Electricity Bills
          </h1>

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              borderRadius: '0.5rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {isAdmin && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                Upload Electricity Bills
              </h2>
              
              {!showUploadForm ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handleFileUpload}
                    style={{ marginBottom: '1rem' }}
                  />
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Select one or more PDF electricity bills to upload and parse
                  </p>
                  
                  {/* Progress Indicator */}
                  {uploadProgress && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #0ea5e9',
                      borderRadius: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: '500', color: '#0c4a6e' }}>
                          Processing files...
                        </span>
                        <span style={{ fontSize: '0.875rem', color: '#0369a1' }}>
                          {uploadProgress.current} of {uploadProgress.total}
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#e0f2fe',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                          height: '100%',
                          backgroundColor: '#0ea5e9',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#0369a1' }}>
                        Current: {uploadProgress.currentFile}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  backgroundColor: '#f9fafb'
                }}>
                  {/* Import Summary */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    backgroundColor: 'white',
                    borderRadius: '0.375rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#16a34a' }}>
                          ✓ {parsingResults.length} Parsed
                        </span>
                      </div>
                      {failedFiles.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#dc2626' }}>
                            ✗ {failedFiles.length} Failed
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Total files: {parsingResults.length + failedFiles.length}
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                    Parsed Bills ({parsingResults.length})
                  </h3>
                  
                  {/* Selection Controls */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    backgroundColor: 'white',
                    borderRadius: '0.375rem',
                    border: '1px solid #e5e7eb',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedParsedBills.size === parsingResults.length && parsingResults.length > 0}
                          onChange={handleSelectAllParsedBills}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                          {selectedParsedBills.size === parsingResults.length && parsingResults.length > 0 ? 'Deselect All' : 'Select All'}
                        </span>
                      </label>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {selectedParsedBills.size > 0 ? `${selectedParsedBills.size} of ${parsingResults.length} selected` : `${parsingResults.length} bills total`}
                      </span>
                    </div>
                  </div>
                  
                  {parsingResults.map((bill, index) => (
                    <div key={index} style={{
                      border: failedImports.has(index) ? '2px solid #dc2626' : '1px solid #e5e7eb',
                      borderRadius: '0.375rem',
                      padding: '1rem',
                      marginBottom: '1rem',
                      backgroundColor: failedImports.has(index) ? '#fef2f2' : 'white',
                      position: 'relative'
                    }}>
                      {failedImports.has(index) && (
                        <div style={{
                          position: 'absolute',
                          top: '-10px',
                          left: '10px',
                          backgroundColor: '#dc2626',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          maxWidth: '300px',
                          wordWrap: 'break-word'
                        }}>
                          IMPORT FAILED: {failedImports.get(index)}
                        </div>
                      )}
                      {/* Bill Selection Checkbox */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '1rem',
                        padding: '0.5rem',
                        backgroundColor: failedImports.has(index) ? '#fee2e2' : '#f9fafb',
                        borderRadius: '0.25rem',
                        border: failedImports.has(index) ? '1px solid #fecaca' : 'none'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedParsedBills.has(index)}
                          onChange={(e) => handleSelectParsedBill(index, e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ 
                          fontSize: '0.875rem', 
                          fontWeight: '500', 
                          color: failedImports.has(index) ? '#dc2626' : '#374151' 
                        }}>
                          {failedImports.has(index) ? 'Retry this bill for import' : 'Select this bill for import'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <strong>Account Number:</strong> {bill.accountNumber}
                        </div>
                        <div>
                          <strong>Bill Date:</strong> {formatDate(bill.billDate)}
                        </div>
                        <div>
                          <strong>Date Range:</strong> {formatDate(bill.billDateRangeStart)} - {formatDate(bill.billDateRangeEnd)}
                        </div>
                        <div>
                          <strong>Units Consumed:</strong> {bill.totalUnitsConsumed.toFixed(2)} kWh
                        </div>
                        <div>
                          <strong>Units per Day:</strong> {bill.unitsPerDay.toFixed(4)} kWh
                        </div>
                        <div>
                          <strong>Reading Type:</strong> {bill.isEstimated ? 'Estimated' : 'Actual'}
                        </div>
                        <div>
                          <strong>Meter Reading:</strong> {bill.meterReading > 0 ? bill.meterReading.toFixed(2) : 'Not available'}
                        </div>
                        <div>
                          <strong>Bill Amount:</strong> {formatCurrency(bill.billAmount)}
                        </div>
                        <div>
                          <strong>Source File:</strong>{' '}
                          <a
                            href={bill.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#3b82f6',
                              textDecoration: 'underline',
                              cursor: 'pointer'
                            }}
                          >
                            {bill.fileName}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Failed Files Section */}
                  {failedFiles.length > 0 && (
                    <div style={{
                      border: '1px solid #fecaca',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      backgroundColor: '#fef2f2',
                      marginTop: '1rem'
                    }}>
                      <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem', color: '#dc2626' }}>
                        Failed Files ({failedFiles.length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {failedFiles.map((failure, index) => (
                          <div key={index} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem',
                            backgroundColor: 'white',
                            borderRadius: '0.375rem',
                            border: '1px solid #fecaca'
                          }}>
                            <span style={{ fontWeight: '500', color: '#374151' }}>
                              {failure.fileName}
                            </span>
                            <span style={{ color: '#dc2626', fontSize: '0.875rem' }}>
                              {failure.error}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Save Progress Indicator */}
                  {saveProgress && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #16a34a',
                      borderRadius: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: '500', color: '#166534' }}>
                          Saving bills...
                        </span>
                        <span style={{ fontSize: '0.875rem', color: '#15803d' }}>
                          {saveProgress.current} of {saveProgress.total}
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#dcfce7',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(saveProgress.current / saveProgress.total) * 100}%`,
                          height: '100%',
                          backgroundColor: '#16a34a',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#15803d' }}>
                        Current: {saveProgress.currentFile}
                      </div>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                      onClick={handleSaveBills}
                      disabled={uploading || selectedParsedBills.size === 0}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: (uploading || selectedParsedBills.size === 0) ? 'not-allowed' : 'pointer',
                        opacity: (uploading || selectedParsedBills.size === 0) ? 0.6 : 1
                      }}
                    >
                      {uploading ? 'Saving...' : `Save ${selectedParsedBills.size} Selected Bills`}
                    </button>
                    <button
                      onClick={handleCancelUpload}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
                  Electricity Bills History
                </h2>
                {!loading && bills.length > 0 && selectedAccountNumber && (
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                    Showing {filteredBills.length} bills for {getAccountNumbersWithParties().find(a => a.accountNumber === selectedAccountNumber)?.partyName} ({selectedAccountNumber})
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Account Number Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Filter by account:</span>
                  <select
                    value={selectedAccountNumber}
                    onChange={(e) => setSelectedAccountNumber(e.target.value)}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      minWidth: '200px'
                    }}
                  >
                    <option value="">Select an account...</option>
                    {getAccountNumbersWithParties().map(({ accountNumber, partyName }) => (
                      <option key={accountNumber} value={accountNumber}>
                        {partyName} ({accountNumber})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Sort by date range:</span>
                  <button
                    onClick={() => setSortAscending(!sortAscending)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    {sortAscending ? '↑ Oldest First' : '↓ Newest First'}
                  </button>
                </div>
              </div>
            </div>
            
            {loading ? (
              <div>Loading bills...</div>
            ) : bills.length === 0 ? (
              <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
                No electricity bills found
              </div>
            ) : !selectedAccountNumber ? (
              <div style={{ 
                color: '#6b7280', 
                fontStyle: 'italic',
                textAlign: 'center',
                padding: '2rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb'
              }}>
                Please select an account number to view electricity bills
              </div>
            ) : filteredBills.length === 0 ? (
              <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
                No electricity bills found for the selected account number
              </div>
            ) : (
              <>
                {/* Bulk Actions Toolbar */}
                {isAdmin && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderBottom: 'none',
                    borderRadius: '0.5rem 0.5rem 0 0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedBills.size === paginatedBills.length && paginatedBills.length > 0}
                          onChange={handleSelectAll}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                          {selectedBills.size === paginatedBills.length && paginatedBills.length > 0 ? 'Deselect All' : 'Select All'}
                        </span>
                      </label>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {selectedBills.size > 0 ? `${selectedBills.size} of ${filteredBills.length} selected` : `${filteredBills.length} bills total`}
                      </span>
                    </div>
                    {selectedBills.size > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        disabled={loading}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          opacity: loading ? 0.6 : 1
                        }}
                      >
                        Delete Selected ({selectedBills.size})
                      </button>
                    )}
                  </div>
                )}
                <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      {isAdmin && (
                        <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: '50px' }}>
                          <input
                            type="checkbox"
                            checked={selectedBills.size === bills.length && bills.length > 0}
                            onChange={handleSelectAll}
                            style={{ cursor: 'pointer' }}
                          />
                        </th>
                      )}
                      <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                        Account
                      </th>
                      <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                        Bill Date
                      </th>
                      <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                        Date Range
                      </th>
                      <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                        Days
                      </th>
                      <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                        Units (kWh)
                      </th>
                      <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                        Meter Reading
                      </th>
                      <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                        Units/Day
                      </th>
                      <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                        Estimated
                      </th>
                      <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBills.map((bill) => (
                      <tr key={bill.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        {isAdmin && (
                          <td style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                            <input
                              type="checkbox"
                              checked={selectedBills.has(bill.id)}
                              onChange={(e) => handleSelectBill(bill.id, e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                          {bill.account_number}
                        </td>
                        <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                          {formatDate(bill.bill_date)}
                        </td>
                        <td style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                          {formatDate(bill.bill_date_range_start)} - {formatDate(bill.bill_date_range_end)}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                          {calculateDaysInRange(bill.bill_date_range_start, bill.bill_date_range_end)}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                          {bill.total_units_consumed.toFixed(2)}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                          {bill.meter_reading ? bill.meter_reading.toFixed(2) : '-'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                          {bill.units_per_day ? bill.units_per_day.toFixed(4) : '-'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                          {bill.is_estimated ? (
                            <span style={{
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              Estimated
                            </span>
                          ) : (
                            <span style={{
                              backgroundColor: '#d1fae5',
                              color: '#065f46',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              Actual
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                          {formatCurrency(bill.bill_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {filteredBills.length > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderTop: 'none',
                  borderRadius: '0 0 0.5rem 0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Rows per page:
                    </span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      style={{
                        padding: '0.25rem 0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.25rem',
                        fontSize: '0.875rem',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {startIndex + 1}-{Math.min(endIndex, filteredBills.length)} of {filteredBills.length}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      style={{
                        padding: '0.25rem 0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.25rem',
                        backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
                        color: currentPage === 1 ? '#9ca3af' : '#374151',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      Previous
                    </button>
                    
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: '0.25rem 0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.25rem',
                        backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
                        color: currentPage === totalPages ? '#9ca3af' : '#374151',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      </DashboardShell>
    </div>
  )
}
