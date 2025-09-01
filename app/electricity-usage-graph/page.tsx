'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import Header from '@/components/Header'

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
  created_at: string
  updated_at: string
}

interface Party {
  id: string
  name: string
  electricity_account_number?: string | null
}

interface GraphDataPoint {
  date: string
  accountNumber: string
  partyName: string
  unitsPerDay: number
  billDate: string
}

export default function ElectricityUsageGraphPage() {
  const { session, supabase, loading: authLoading } = useAuth()
  const router = useRouter()
  
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bills, setBills] = useState<ElectricityBill[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
    start: '',
    end: ''
  })
  const [graphData, setGraphData] = useState<GraphDataPoint[]>([])

  useEffect(() => {
    if (session && !authLoading) {
      checkAdminStatus()
      loadBills()
      loadParties()
    }
  }, [session, authLoading])

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
        .order('bill_date', { ascending: false })

      if (error) throw error
      setBills(data || [])
    } catch (error) {
      console.error('Error loading bills:', error)
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

  // Filter bills based on selected accounts and date range
  const getFilteredBills = () => {
    let filtered = bills.filter(bill => selectedAccounts.includes(bill.account_number))
    
    if (dateRange.start) {
      filtered = filtered.filter(bill => bill.bill_date >= dateRange.start)
    }
    
    if (dateRange.end) {
      filtered = filtered.filter(bill => bill.bill_date <= dateRange.end)
    }
    
    return filtered.sort((a, b) => new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime())
  }

  // Generate graph data
  useEffect(() => {
    const filteredBills = getFilteredBills()
    const data: GraphDataPoint[] = filteredBills.map(bill => {
      const party = parties.find(p => p.electricity_account_number === bill.account_number)
      return {
        date: bill.bill_date,
        accountNumber: bill.account_number,
        partyName: party?.name || 'Unknown Party',
        unitsPerDay: bill.units_per_day || 0,
        billDate: bill.bill_date
      }
    })
    setGraphData(data)
  }, [selectedAccounts, dateRange, bills, parties])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatMonthYear = (dateString: string) => {
    const date = new Date(dateString)
    const month = date.toLocaleDateString('en-AU', { month: 'short' })
    const year = date.getFullYear().toString()
    return { month, year }
  }

  const handleAccountToggle = (accountNumber: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountNumber)
        ? prev.filter(acc => acc !== accountNumber)
        : [...prev, accountNumber]
    )
  }

  const handleSelectAllAccounts = () => {
    const allAccounts = getAccountNumbersWithParties().map(acc => acc.accountNumber)
    setSelectedAccounts(allAccounts)
  }

  const handleClearAllAccounts = () => {
    setSelectedAccounts([])
  }

  // Calculate chart dimensions and data
  const chartWidth = 800
  const chartHeight = 450
  const margin = { top: 20, right: 20, bottom: 80, left: 60 }
  const innerWidth = chartWidth - margin.left - margin.right
  const innerHeight = chartHeight - margin.top - margin.bottom

  const maxUnitsPerDay = Math.max(...graphData.map(d => d.unitsPerDay), 0)
  const minDate = graphData.length > 0 ? new Date(Math.min(...graphData.map(d => new Date(d.date).getTime()))) : new Date()
  const maxDate = graphData.length > 0 ? new Date(Math.max(...graphData.map(d => new Date(d.date).getTime()))) : new Date()

  // Color palette for different accounts
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="p-6">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-4">Loading...</h1>
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="p-6">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You need admin privileges to view this page.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardShell>
        <div className="p-6">
          <Header />
          
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Electricity Usage Graph</h1>
              <p className="text-gray-600">View average daily electricity consumption over time</p>
            </div>

            {/* Account Selection */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Select Accounts</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {getAccountNumbersWithParties().map(({ accountNumber, partyName }) => (
                  <label key={accountNumber} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(accountNumber)}
                      onChange={() => handleAccountToggle(accountNumber)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">
                      {partyName} ({accountNumber})
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAllAccounts}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Select All
                </button>
                <button
                  onClick={handleClearAllAccounts}
                  className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Date Range Selection */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Date Range</h2>
              <div className="flex gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => setDateRange({ start: '', end: '' })}
                  className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  All Time
                </button>
              </div>
            </div>

            {/* Graph */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Usage Graph</h2>
              
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : selectedAccounts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Please select at least one account to view the graph
                </div>
              ) : graphData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No data available for the selected accounts and date range
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <svg width={chartWidth} height={chartHeight} className="mx-auto">
                    {/* Chart background */}
                    <rect
                      x={margin.left}
                      y={margin.top}
                      width={innerWidth}
                      height={innerHeight}
                      fill="#f8fafc"
                      stroke="#e2e8f0"
                    />
                    
                    {/* Y-axis */}
                    <line
                      x1={margin.left}
                      y1={margin.top}
                      x2={margin.left}
                      y2={margin.top + innerHeight}
                      stroke="#64748b"
                      strokeWidth={2}
                    />
                    
                    {/* X-axis */}
                    <line
                      x1={margin.left}
                      y1={margin.top + innerHeight}
                      x2={margin.left + innerWidth}
                      y2={margin.top + innerHeight}
                      stroke="#64748b"
                      strokeWidth={2}
                    />
                    
                    {/* Y-axis label */}
                    <text
                      x={margin.left / 2}
                      y={margin.top + innerHeight / 2}
                      textAnchor="middle"
                      transform={`rotate(-90, ${margin.left / 2}, ${margin.top + innerHeight / 2})`}
                      fontSize="12"
                      fill="#64748b"
                    >
                      Average Daily Usage (kWh)
                    </text>
                    
                    {/* X-axis label */}
                    <text
                      x={margin.left + innerWidth / 2}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      fontSize="12"
                      fill="#64748b"
                    >
                      Date
                    </text>
                    
                    {/* Y-axis ticks */}
                    {[0, maxUnitsPerDay * 0.25, maxUnitsPerDay * 0.5, maxUnitsPerDay * 0.75, maxUnitsPerDay].map((tick, i) => {
                      const y = margin.top + innerHeight - (tick / maxUnitsPerDay) * innerHeight
                      return (
                        <g key={i}>
                          <line
                            x1={margin.left - 5}
                            y1={y}
                            x2={margin.left}
                            y2={y}
                            stroke="#64748b"
                            strokeWidth={1}
                          />
                          <text
                            x={margin.left - 10}
                            y={y + 4}
                            textAnchor="end"
                            fontSize="10"
                            fill="#64748b"
                          >
                            {tick.toFixed(1)}
                          </text>
                        </g>
                      )
                    })}
                    
                                         {/* X-axis ticks and labels */}
                     {(() => {
                       // Get unique dates for x-axis positioning
                       const uniqueDates = [...new Set(graphData.map(d => d.date))].sort()
                       const filteredDates = uniqueDates.filter((_, i) => i % 3 === 0)
                       const yearGroups: { [key: string]: { dates: string[], middleIndex: number } } = {}
                       
                       // Group dates by year
                       filteredDates.forEach((date) => {
                         const year = new Date(date).getFullYear().toString()
                         if (!yearGroups[year]) {
                           yearGroups[year] = { dates: [], middleIndex: 0 }
                         }
                         yearGroups[year].dates.push(date)
                       })
                       
                       // Calculate middle index for each year
                       Object.keys(yearGroups).forEach(year => {
                         const group = yearGroups[year]
                         group.middleIndex = Math.floor(group.dates.length / 2)
                       })
                       
                       return filteredDates.map((date, i) => {
                         const x = margin.left + (i / (filteredDates.length - 1)) * innerWidth
                         const { month, year } = formatMonthYear(date)
                         const isMiddleOfYear = yearGroups[year].dates.indexOf(date) === yearGroups[year].middleIndex
                         
                         return (
                           <g key={i}>
                             <line
                               x1={x}
                               y1={margin.top + innerHeight}
                               x2={x}
                               y2={margin.top + innerHeight + 5}
                               stroke="#64748b"
                               strokeWidth={1}
                             />
                             {/* Month label */}
                             <text
                               x={x}
                               y={margin.top + innerHeight + 15}
                               textAnchor="middle"
                               fontSize="10"
                               fill="#64748b"
                             >
                               {month}
                             </text>
                             {/* Year label - only show once per year in the middle */}
                             {isMiddleOfYear && (
                               <text
                                 x={x}
                                 y={margin.top + innerHeight + 28}
                                 textAnchor="middle"
                                 fontSize="10"
                                 fill="#64748b"
                               >
                                 {year}
                               </text>
                             )}
                           </g>
                         )
                       })
                     })()}
                    
                                         {/* Data points and lines */}
                     {selectedAccounts.map((accountNumber, accountIndex) => {
                       const accountData = graphData.filter(d => d.accountNumber === accountNumber)
                       const color = colors[accountIndex % colors.length]
                       
                       // Get unique dates for positioning
                       const uniqueDates = [...new Set(graphData.map(d => d.date))].sort()
                       
                       return accountData.map((dataPoint, i) => {
                         const dateIndex = uniqueDates.indexOf(dataPoint.date)
                         const x = margin.left + (dateIndex / (uniqueDates.length - 1)) * innerWidth
                         const y = margin.top + innerHeight - (dataPoint.unitsPerDay / maxUnitsPerDay) * innerHeight
                         
                         return (
                           <g key={`${accountNumber}-${i}`}>
                             {/* Data point */}
                             <circle
                               cx={x}
                               cy={y}
                               r={4}
                               fill={color}
                               stroke="white"
                               strokeWidth={2}
                             />
                             
                             {/* Line to next point */}
                             {i < accountData.length - 1 && (
                               (() => {
                                 const nextDataPoint = accountData[i + 1]
                                 const nextDateIndex = uniqueDates.indexOf(nextDataPoint.date)
                                 const nextX = margin.left + (nextDateIndex / (uniqueDates.length - 1)) * innerWidth
                                 const nextY = margin.top + innerHeight - (nextDataPoint.unitsPerDay / maxUnitsPerDay) * innerHeight
                                 
                                 return (
                                   <line
                                     x1={x}
                                     y1={y}
                                     x2={nextX}
                                     y2={nextY}
                                     stroke={color}
                                     strokeWidth={2}
                                   />
                                 )
                               })()
                             )}
                             
                             {/* Tooltip on hover */}
                             <title>
                               {dataPoint.partyName} ({dataPoint.accountNumber})
                               Date: {formatDate(dataPoint.date)}
                               Usage: {dataPoint.unitsPerDay.toFixed(2)} kWh/day
                             </title>
                           </g>
                         )
                       })
                     })}
                    
                    {/* Legend */}
                    <g transform={`translate(${margin.left}, ${margin.top - 10})`}>
                      {selectedAccounts.map((accountNumber, i) => {
                        const party = parties.find(p => p.electricity_account_number === accountNumber)
                        const color = colors[i % colors.length]
                        const y = i * 20
                        
                        return (
                          <g key={accountNumber}>
                            <circle
                              cx={0}
                              cy={y + 5}
                              r={4}
                              fill={color}
                            />
                            <text
                              x={15}
                              y={y + 8}
                              fontSize="12"
                              fill="#374151"
                            >
                              {party?.name || 'Unknown Party'} ({accountNumber})
                            </text>
                          </g>
                        )
                      })}
                    </g>
                  </svg>
                </div>
              )}
              
              {/* Summary Stats */}
              {graphData.length > 0 && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-900">Total Data Points</h3>
                    <p className="text-2xl font-bold text-blue-600">{graphData.length}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-900">Average Usage</h3>
                    <p className="text-2xl font-bold text-green-600">
                      {(graphData.reduce((sum, d) => sum + d.unitsPerDay, 0) / graphData.length).toFixed(2)} kWh/day
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-purple-900">Peak Usage</h3>
                    <p className="text-2xl font-bold text-purple-600">
                      {Math.max(...graphData.map(d => d.unitsPerDay)).toFixed(2)} kWh/day
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardShell>
    </div>
  )
}
