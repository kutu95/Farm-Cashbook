"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import supabase from "@/lib/supabaseClient"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import Alert from "@/components/Alert"
import { fieldControlClass, FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"
import { todayISO } from "@/lib/format"

export default function AddPaymentPage() {
  const [partyId, setPartyId] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState(todayISO())
  const [description, setDescription] = useState("")
  const [sourceType, setSourceType] = useState("Bank deposit")
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
      if (data.length > 0) setPartyId(data[0].id)
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setError("Unable to get user session")
      return
    }

    const user_id = session.user.id

    const { error: insertError } = await supabase.from("payments").insert([
      {
        user_id,
        party_id: partyId,
        amount: parseFloat(amount),
        payment_date: paymentDate,
        description,
        source_type: sourceType
      }
    ])

    if (insertError) {
      setError(insertError.message)
    } else {
      setNotice("Payment saved.")
      setAmount("")
      setDescription("")
      setPaymentDate(todayISO())
      setSourceType("Bank deposit")
    }
  }

  return (
    <AppShell>
      <PageFrame title="Add payment" width="3xl">
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <FormField id="party" label="Party">
          <select id="party" className={fieldControlClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            {parties.map((party: any) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
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
          <Button type="submit">Save payment</Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard">Cancel</Link>
          </Button>
        </div>
      </form>
      </PageFrame>
    </AppShell>
  )
}