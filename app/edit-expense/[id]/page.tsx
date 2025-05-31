"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

export default function EditExpensePage({ params }) {
  const router = useRouter()
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState("")
  const [allocationType, setAllocationType] = useState<"fixed" | "percentage">("fixed")
  const [allocations, setAllocations] = useState<any[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load expense data
      const { data: expenseData, error: expenseError } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", params.id)
        .single()

      if (expenseError) throw expenseError

      setDescription(expenseData.description)
      setAmount(expenseData.amount.toString())
      setExpenseDate(expenseData.expense_date)

      // Load parties and allocations
      const [partiesResponse, allocationsResponse] = await Promise.all([
        supabase.from("parties").select("*"),
        supabase.from("expense_allocations")
          .select("*")
          .eq("expense_id", params.id)
      ])

      if (partiesResponse.error) throw partiesResponse.error
      if (allocationsResponse.error) throw allocationsResponse.error

      setParties(partiesResponse.data)

      // Create allocations array with existing values
      const existingAllocations = allocationsResponse.data
      const allAllocations = partiesResponse.data.map((party: any) => {
        const existing = existingAllocations.find((a: any) => a.party_id === party.id)
        return {
          party_id: party.id,
          amount: existing ? existing.allocated_amount.toString() : ""
        }
      })

      setAllocations(allAllocations)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      // Update expense
      const { error: updateError } = await supabase
        .from("expenses")
        .update({
          description,
          amount: parseFloat(amount),
          expense_date: expenseDate
        })
        .eq("id", params.id)

      if (updateError) throw updateError

      // Delete existing allocations
      const { error: deleteError } = await supabase
        .from("expense_allocations")
        .delete()
        .eq("expense_id", params.id)

      if (deleteError) throw deleteError

      // Insert new allocations
      const newAllocations = allocations
        .filter(alloc => parseFloat(alloc.amount || "0") > 0)
        .map(alloc => ({
          expense_id: params.id,
          party_id: alloc.party_id,
          allocated_amount: parseFloat(alloc.amount)
        }))

      if (newAllocations.length > 0) {
        const { error: insertError } = await supabase
          .from("expense_allocations")
          .insert(newAllocations)

        if (insertError) throw insertError
      }

      router.push("/dashboard")
    } catch (error: any) {
      setError(error.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this expense?")) {
      return
    }

    // Delete allocations first (due to foreign key constraint)
    const { error: allocDeleteError } = await supabase
      .from("expense_allocations")
      .delete()
      .eq("expense_id", params.id)

    if (allocDeleteError) {
      setError(allocDeleteError.message)
      return
    }

    // Then delete the expense
    const { error: expenseDeleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", params.id)

    if (expenseDeleteError) {
      setError(expenseDeleteError.message)
      return
    }

    router.push("/dashboard")
  }

  if (loading) {
    return (
      <div className="p-6">
        <Header />
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Header />
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Edit Expense</h1>
        <button 
          onClick={handleDelete}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Delete Expense
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Amount</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Allocation Type</label>
          <select
            value={allocationType}
            onChange={(e) => setAllocationType(e.target.value as "fixed" | "percentage")}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          >
            <option value="fixed">Fixed Amount</option>
            <option value="percentage">Percentage</option>
          </select>
        </div>

        <div className="space-y-2">
          <h3 className="font-medium">Party Allocations</h3>
          {parties.map((party, index) => (
            <div key={party.id} className="flex items-center gap-2">
              <label className="w-1/3">{party.name}</label>
              <input
                type="number"
                step="0.01"
                value={allocations[index]?.amount || ""}
                onChange={(e) => {
                  const newAllocations = [...allocations]
                  newAllocations[index] = {
                    ...newAllocations[index],
                    amount: e.target.value
                  }
                  setAllocations(newAllocations)
                }}
                placeholder={allocationType === "fixed" ? "Amount" : "Percentage"}
                className="w-2/3 border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Update Expense
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
} 