"use client"

import { useEffect, useState, useRef } from "react"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

export default function AddExpensePage() {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState("")
  const [allocationType, setAllocationType] = useState<"fixed" | "percentage">("fixed")
  const [allocations, setAllocations] = useState<any[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [error, setError] = useState("")
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadParties()
  }, [])

  const loadParties = async () => {
    const { data, error } = await supabase.from("parties").select("*")
    if (error) {
      setError(error.message)
    } else {
      setParties(data)
      setAllocations(data.map((party: any) => ({ party_id: party.id, amount: "" })))
    }
  }

  const handleAllocationChange = (party_id: string, value: string) => {
    setAllocations((prev) =>
      prev.map((alloc) => (alloc.party_id === party_id ? { ...alloc, amount: value } : alloc))
    )
  }

  const handleBillImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/parse-bill', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import bill');
      }

      // Update form fields with bill data
      setDescription(data.description);
      setAmount(data.amount.toString());
      setExpenseDate(data.date);
      setAllocationType("percentage");

      // Update allocations
      setAllocations(prev => 
        prev.map(alloc => {
          const matchingAllocation = data.allocations.find(
            (a: any) => a.party_id === alloc.party_id
          );
          return {
            ...alloc,
            amount: matchingAllocation ? matchingAllocation.percentage.toString() : "0"
          };
        })
      );

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import bill');
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    const filteredAllocations = allocations.filter(alloc => parseFloat(alloc.amount || "0") > 0)
    const total = filteredAllocations.reduce((sum, alloc) => sum + parseFloat(alloc.amount || "0"), 0)

    if (allocationType === "percentage" && total !== 100) {
      setError("Percentages must total 100% (ignoring zero entries)")
      return
    }

    if (allocationType === "fixed" && total !== parseFloat(amount)) {
      setError("Fixed amounts must total full expense amount (ignoring zero entries)")
      return
    }

    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .insert([{ description, amount, expense_date: expenseDate }])
      .select()
      .single()

    if (expenseError) {
      setError(expenseError.message)
      return
    }

    const expense_id = expenseData.id

    const allocationInserts = filteredAllocations.map((alloc) => ({
      expense_id,
      party_id: alloc.party_id,
      allocated_amount: allocationType === "fixed"
        ? parseFloat(alloc.amount)
        : (parseFloat(amount) * parseFloat(alloc.amount) / 100)
    })).filter(a => a.allocated_amount > 0)

    const { error: allocError } = await supabase.from("expense_allocations").insert(allocationInserts)

    if (allocError) {
      setError(allocError.message)
      return
    }

    window.location.href = "/dashboard"
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Header />
      <h1 className="text-xl font-bold mb-4">Add Expense</h1>
      
      <div className="mb-6">
        <input
          type="file"
          accept=".pdf"
          onChange={handleBillImport}
          className="hidden"
          ref={fileInputRef}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {importing ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Importing...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Import Electricity Bill
            </>
          )}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>Description:</label>
          <input className="border p-2 w-full" value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>

        <div>
          <label>Amount:</label>
          <input className="border p-2 w-full" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>

        <div>
          <label>Date:</label>
          <input className="border p-2 w-full" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
        </div>

        <div>
          <label>Allocation Type:</label>
          <select className="border p-2 w-full" value={allocationType} onChange={(e) => setAllocationType(e.target.value as any)}>
            <option value="fixed">Fixed Amount</option>
            <option value="percentage">Percentage</option>
          </select>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Allocations:</h2>
          {allocations.map((alloc, idx) => (
            <div key={idx} className="flex items-center mb-2">
              <span className="w-1/3">{parties.find(p => p.id === alloc.party_id)?.name}:</span>
              <input
                type="number"
                className="border p-2 w-1/2"
                value={alloc.amount}
                onChange={(e) => handleAllocationChange(alloc.party_id, e.target.value)}
              />
              <span className="ml-2">{allocationType === "percentage" ? "%" : "AUD"}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Save Expense
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}