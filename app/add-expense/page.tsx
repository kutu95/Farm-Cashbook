"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import supabase from "@/lib/supabaseClient"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import Alert from "@/components/Alert"
import { AllocationFields, fieldControlClass, FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"
import { todayISO } from "@/lib/format"

export default function AddExpensePage() {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState(todayISO())
  const [allocationType, setAllocationType] = useState<"fixed" | "percentage">("fixed")
  const [allocations, setAllocations] = useState<any[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

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

    setNotice("Expense saved.")
    setDescription("")
    setAmount("")
    setExpenseDate(todayISO())
    setAllocations(parties.map((party: any) => ({ party_id: party.id, amount: "" })))
  }

  const target = allocationType === "percentage" ? 100 : Number.parseFloat(amount || "0") || 0
  const allocated = allocations.reduce((sum, alloc) => sum + (Number.parseFloat(alloc.amount || "0") || 0), 0)
  const splitMatches = target > 0 && Math.abs(target - allocated) < 0.001

  return (
    <AppShell>
      <PageFrame
        title="Add expense"
        width="3xl"
        description="Synergy electricity bills are uploaded on Electricity bills, which also records the expense."
      >
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <FormField id="description" label="Description">
          <input id="description" className={fieldControlClass} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </FormField>

        <FormField id="amount" label="Amount">
          <input id="amount" className={fieldControlClass} type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </FormField>

        <FormField id="expense-date" label="Date">
          <input id="expense-date" className={fieldControlClass} type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
        </FormField>

        <FormField id="allocation-type" label="Allocation type">
          <select id="allocation-type" className={fieldControlClass} value={allocationType} onChange={(e) => setAllocationType(e.target.value as "fixed" | "percentage")}>
            <option value="fixed">Fixed amount</option>
            <option value="percentage">Percentage</option>
          </select>
        </FormField>

        <AllocationFields
          mode={allocationType}
          target={target}
          rows={allocations.map((alloc) => ({
            partyId: alloc.party_id,
            name: parties.find((party) => party.id === alloc.party_id)?.name || "Party",
            value: alloc.amount,
          }))}
          onChange={handleAllocationChange}
        />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!splitMatches}>
            Save expense
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard">Cancel</Link>
          </Button>
          <Link href="/electricity-bills" className="inline-flex h-10 items-center px-2 text-sm text-green-800 underline-offset-2 hover:underline">
            Upload a bill instead
          </Link>
        </div>
      </form>
      </PageFrame>
    </AppShell>
  )
}