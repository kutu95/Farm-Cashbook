"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import supabase from "@/lib/supabaseClient"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import EmptyState from "@/components/EmptyState"
import Alert from "@/components/Alert"
import { AllocationFields, fieldControlClass, FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"
import DocumentAttachments from "@/components/DocumentAttachments"

export default function EditExpensePage({ params }) {
  const router = useRouter()
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState("")
  const [allocationType, setAllocationType] = useState<"fixed" | "percentage">("fixed")
  const [allocations, setAllocations] = useState<any[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
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

      const filtered = allocations.filter(alloc => parseFloat(alloc.amount || "0") > 0)
      const total = filtered.reduce((sum, alloc) => sum + parseFloat(alloc.amount || "0"), 0)
      if (allocationType === "percentage" && Math.abs(total - 100) > 0.001) {
        setError("Percentages must total 100%.")
        return
      }
      if (allocationType === "fixed" && Math.abs(total - parseFloat(amount)) > 0.001) {
        setError("Fixed amounts must total the expense amount.")
        return
      }

      const newAllocations = filtered.map(alloc => ({
        expense_id: params.id,
        party_id: alloc.party_id,
        allocated_amount: allocationType === "fixed"
          ? parseFloat(alloc.amount)
          : (parseFloat(amount) * parseFloat(alloc.amount) / 100)
      }))

      if (newAllocations.length > 0) {
        const { error: insertError } = await supabase
          .from("expense_allocations")
          .insert(newAllocations)

        if (insertError) throw insertError
      }

      setNotice("Changes saved.")
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

  const target = allocationType === "percentage" ? 100 : Number.parseFloat(amount || "0") || 0
  const allocated = allocations.reduce((sum, alloc) => sum + (Number.parseFloat(alloc.amount || "0") || 0), 0)
  const splitMatches = target > 0 && Math.abs(target - allocated) < 0.001

  if (loading) {
    return (
      <AppShell>
        <EmptyState title="Loading expense" />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageFrame
        title="Edit expense"
        width="3xl"
        actions={<Button type="button" variant="destructive" onClick={handleDelete}>Delete expense</Button>}
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
            value: alloc.amount || "",
          }))}
          onChange={(partyId, value) => {
            setAllocations((current) => current.map((alloc) => alloc.party_id === partyId ? { ...alloc, amount: value } : alloc))
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!splitMatches}>Save changes</Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/statements">Cancel</Link>
          </Button>
        </div>
      </form>

      <div className="mt-8 border-t pt-6">
        <DocumentAttachments expenseId={params.id} onUpdate={() => {}} />
      </div>
      </PageFrame>
    </AppShell>
  )
} 