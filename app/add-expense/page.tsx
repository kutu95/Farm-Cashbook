"use client"

import { useEffect, useState } from "react"
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
      {error && <p className="text-red-600">{error}</p>}
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

        <button className="bg-blue-600 text-white px-4 py-2 rounded">Save Expense</button>
      </form>
    </div>
  )
}