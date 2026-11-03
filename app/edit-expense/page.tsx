"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import supabase from "@/lib/supabaseClient"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import EmptyState from "@/components/EmptyState"
import Alert from "@/components/Alert"
import { AllocationFields, fieldControlClass, FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"
import DocumentAttachments from "@/components/DocumentAttachments"

function EditExpenseContent() {
  const searchParams = useSearchParams()
  const expenseId = searchParams.get("id")

  const [amount, setAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState("")
  const [description, setDescription] = useState("")
  const [allocationMode, setAllocationMode] = useState("fixed")
  const [allocations, setAllocations] = useState<any[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

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

    setNotice("Changes saved.")
  }

  const allocationModeName = allocationMode === "percent" ? "percentage" : "fixed"
  const target = allocationModeName === "percentage" ? 100 : Number.parseFloat(amount || "0") || 0
  const allocated = allocations.reduce((sum, row) => {
    const raw = allocationModeName === "percentage" ? row.percent : row.amount
    return sum + (Number.parseFloat(raw || "0") || 0)
  }, 0)
  const splitMatches = target > 0 && Math.abs(target - allocated) < 0.001

  const handleAllocationChange = (index: number, field: string, value: string) => {
    const newAllocations = [...allocations]
    newAllocations[index] = { ...newAllocations[index], [field]: value }
    setAllocations(newAllocations)
  }

  return (
    <AppShell>
      <PageFrame title="Edit expense" width="3xl">
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <FormField id="amount" label="Amount">
          <input id="amount" className={fieldControlClass} type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </FormField>
        <FormField id="expense-date" label="Expense date">
          <input id="expense-date" className={fieldControlClass} type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
        </FormField>
        <FormField id="description" label="Description">
          <input id="description" className={fieldControlClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField id="allocation-mode" label="Allocation type">
          <select id="allocation-mode" className={fieldControlClass} value={allocationMode} onChange={(e) => setAllocationMode(e.target.value)}>
            <option value="fixed">Fixed amount</option>
            <option value="percent">Percentage</option>
          </select>
        </FormField>
        <AllocationFields
          mode={allocationModeName}
          target={target}
          rows={allocations.map((row) => ({
            partyId: row.party_id,
            name: parties.find((party) => party.id === row.party_id)?.name || "Party",
            value: allocationMode === "fixed" ? row.amount : row.percent,
          }))}
          onChange={(partyId, value) => {
            const index = allocations.findIndex((row) => row.party_id === partyId)
            if (index >= 0) handleAllocationChange(index, allocationMode === "fixed" ? "amount" : "percent", value)
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!splitMatches}>Save changes</Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/statements">Cancel</Link>
          </Button>
        </div>
      </form>

      {expenseId && (
        <div className="mt-8 border-t pt-6">
          <DocumentAttachments 
            expenseId={expenseId}
            onUpdate={() => {
              // Optionally refresh expense data if needed
              loadExpense()
            }}
          />
        </div>
      )}
      </PageFrame>
    </AppShell>
  )
}

export default function EditExpensePage() {
  return (
    <Suspense fallback={<AppShell><EmptyState title="Loading expense" /></AppShell>}>
      <EditExpenseContent />
    </Suspense>
  )
}