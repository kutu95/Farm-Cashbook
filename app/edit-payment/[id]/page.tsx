"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import supabase from "@/lib/supabaseClient"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import EmptyState from "@/components/EmptyState"
import Alert from "@/components/Alert"
import { fieldControlClass, FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"
import DocumentAttachments from "@/components/DocumentAttachments"

function EditPaymentContent({ params }) {
  const router = useRouter()
  const paymentId = params.id

  const [partyId, setPartyId] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState("")
  const [description, setDescription] = useState("")
  const [sourceType, setSourceType] = useState("Bank deposit")
  const [parties, setParties] = useState<any[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (paymentId) {
      loadPayment()
    }
    loadParties()
  }, [paymentId])

  const loadParties = async () => {
    const { data, error } = await supabase.from("parties").select("*")
    if (!error) {
      setParties(data)
    }
  }

  const loadPayment = async () => {
    const { data, error } = await supabase.from("payments").select("*").eq("id", paymentId).single()
    if (error) {
      setError(error.message)
    } else {
      setPartyId(data.party_id)
      setAmount(data.amount)
      setPaymentDate(data.payment_date)
      setDescription(data.description || "")
      setSourceType(data.source_type)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    const { error: updateError } = await supabase.from("payments").update({
      party_id: partyId,
      amount: parseFloat(amount),
      payment_date: paymentDate,
      description,
      source_type: sourceType
    }).eq("id", paymentId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setNotice("Changes saved.")
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this payment?")) {
      return
    }

    const { error: deleteError } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      router.push("/dashboard")
    }
  }

  if (loading) {
    return (
      <AppShell>
        <EmptyState title="Loading payment" />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageFrame
        title="Edit payment"
        width="3xl"
        actions={<Button type="button" variant="destructive" onClick={handleDelete}>Delete payment</Button>}
      >
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <FormField id="party" label="Party">
          <select id="party" className={fieldControlClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            {parties.map((party: any) => (
              <option key={party.id} value={party.id}>{party.name}</option>
            ))}
          </select>
        </FormField>
        <FormField id="amount" label="Amount">
          <input id="amount" className={fieldControlClass} type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </FormField>
        <FormField id="payment-date" label="Payment date">
          <input id="payment-date" className={fieldControlClass} type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        </FormField>
        <FormField id="description" label="Description">
          <input id="description" className={fieldControlClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField id="source-type" label="Source type">
          <select id="source-type" className={fieldControlClass} value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
            <option value="Bank deposit">Bank deposit</option>
            <option value="Payment to customer">Payment to customer</option>
            <option value="Credit transfer">Credit transfer</option>
            <option value="Credit">Credit</option>
          </select>
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save changes</Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/statements">Cancel</Link>
          </Button>
        </div>
      </form>

      <div className="mt-8 border-t pt-6">
        <DocumentAttachments 
          paymentId={paymentId}
          onUpdate={() => {
            // Optionally refresh payment data if needed
            loadPayment()
          }}
        />
      </div>
      </PageFrame>
    </AppShell>
  )
}

export default function EditPaymentPage({ params }) {
  return (
    <Suspense fallback={<AppShell><EmptyState title="Loading payment" /></AppShell>}>
      <EditPaymentContent params={params} />
    </Suspense>
  )
} 