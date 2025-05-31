"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

export default function EditPaymentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentId = searchParams.get("id")

  const [partyId, setPartyId] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState("")
  const [description, setDescription] = useState("")
  const [sourceType, setSourceType] = useState("Bank deposit")
  const [parties, setParties] = useState<any[]>([])
  const [error, setError] = useState("")

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
      router.push("/dashboard")
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Header />
      <h1 className="text-xl font-bold mb-4">Edit Payment</h1>
      {error && <p className="text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label>Party:</label>
          <select className="border p-2 w-full" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            {parties.map((party: any) => (
              <option key={party.id} value={party.id}>{party.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Amount:</label>
          <input className="border p-2 w-full" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>

        <div>
          <label>Payment Date:</label>
          <input className="border p-2 w-full" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        </div>

        <div>
          <label>Description:</label>
          <input className="border p-2 w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label>Source Type:</label>
          <select className="border p-2 w-full" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
            <option value="Bank deposit">Bank deposit</option>
            <option value="Payment to customer">Payment to customer</option>
            <option value="Credit transfer">Credit transfer</option>
          </select>
        </div>

        <button className="bg-blue-600 text-white px-4 py-2 rounded">Save Changes</button>
      </form>
    </div>
  )
}