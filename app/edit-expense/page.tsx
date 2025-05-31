"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

function EditExpenseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const expenseId = searchParams.get("id")

  const [amount, setAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState("")
  const [description, setDescription] = useState("")
  const [allocationMode, setAllocationMode] = useState("fixed")
  const [allocations, setAllocations] = useState<any[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (expenseId) loadExpense()
    loadParties()
  }, [expenseId])

  const loadParties = async () => {
    const { data, error } = await supabase.from("parties").select("*")
    if (!error) {
      setParties(data)
      setAllocations(data.map((p: any) => ({ party_id: p.id, amount: "", percent: "" })))
    }
  }

  const loadExpense = async () => {
    const { data, error } = await supabase.from("expenses").select("*").eq("id", expenseId).single()
    if (!error) {
      setAmount(data.amount)
      setExpenseDate(data.expense_date)
      setDescription(data.description || "")
    }

    const { data: allocs } = await supabase.from("expense_allocations").select("*").eq("expense_id", expenseId)
    if (allocs) {
      setAllocations(prev => prev.map(a => {
        const found = allocs.find((x: any) => x.party_id === a.party_id)
        return found ? { ...a, amount: found.allocated_amount.toString() } : a
      }))
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      setError("Unable to get session")
      return
    }

    const user_id = session.user.id

    // Validate percentages sum if using percentage mode
    if (allocationMode === "percent") {
      const totalPercent = allocations.reduce((sum, a) => sum + (parseFloat(a.percent) || 0), 0)
      if (totalPercent !== 100) {
        setError("Percentages must total 100%")
        return
      }
    }

    const { error: updateError } = await supabase.from("expenses").update({
      user_id, amount: parseFloat(amount), expense_date: expenseDate, description
    }).eq("id", expenseId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    // Delete old allocations
    await supabase.from("expense_allocations").delete().eq("expense_id", expenseId)

    // Insert new allocations
    const allocationInserts = allocations
      .map(a => {
        let allocated = 0
        if (allocationMode === "percent") {
          allocated = parseFloat(amount) * (parseFloat(a.percent) || 0) / 100
        } else {
          allocated = parseFloat(a.amount) || 0
        }
        return allocated > 0 ? { expense_id: expenseId, party_id: a.party_id, allocated_amount: allocated } : null
      })
      .filter(a => a !== null)

    if (allocationInserts.length > 0) {
      await supabase.from("expense_allocations").insert(allocationInserts)
    }

    router.push("/dashboard")
  }

  const handleAllocationChange = (index: number, field: string, value: string) => {
    const newAllocations = [...allocations]
    newAllocations[index] = { ...newAllocations[index], [field]: value }
    setAllocations(newAllocations)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Header />
      <h1 className="text-xl font-bold mb-4">Edit Expense</h1>
      {error && <p className="text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>Amount:</label>
          <input className="border p-2 w-full" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>

        <div>
          <label>Expense Date:</label>
          <input className="border p-2 w-full" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
        </div>

        <div>
          <label>Description:</label>
          <input className="border p-2 w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label>Allocation Mode:</label>
          <select className="border p-2 w-full" value={allocationMode} onChange={(e) => setAllocationMode(e.target.value)}>
            <option value="fixed">Fixed Amounts</option>
            <option value="percent">Percentages</option>
          </select>
        </div>

        <div>
          <label>Allocations:</label>
          {allocations.map((a, idx) => (
            <div key={a.party_id} className="flex space-x-2 mb-2">
              <div className="w-1/3">{parties.find(p => p.id === a.party_id)?.name}</div>
              {allocationMode === "fixed" ? (
                <input className="border p-2 w-2/3" type="number" value={a.amount}
                  onChange={(e) => handleAllocationChange(idx, "amount", e.target.value)} />
              ) : (
                <input className="border p-2 w-2/3" type="number" value={a.percent}
                  onChange={(e) => handleAllocationChange(idx, "percent", e.target.value)} />
              )}
            </div>
          ))}
        </div>

        <button className="bg-blue-600 text-white px-4 py-2 rounded">Save Changes</button>
      </form>
    </div>
  )
}

export default function EditExpensePage() {
  return (
    <Suspense fallback={<div className="p-6"><Header /><div>Loading...</div></div>}>
      <EditExpenseContent />
    </Suspense>
  )
}