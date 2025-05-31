"use client"

import { useEffect, useState } from "react"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

export default function AddPaymentPage() {
  const [partyId, setPartyId] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState("")
  const [description, setDescription] = useState("")
  const [sourceType, setSourceType] = useState("Bank deposit")
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
      window.location.href = "/dashboard"
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Header />
      <h1 className="text-xl font-bold mb-4">Add Payment</h1>
      {error && <p className="text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label>Party:</label>
          <select className="border p-2 w-full" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            {parties.map((party: any) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
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

        <div className="flex gap-4">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Save Payment
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