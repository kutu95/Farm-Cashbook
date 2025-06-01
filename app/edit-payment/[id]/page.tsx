"use client"

import { useEffect, useState, Suspense, use } from "react"
import { useRouter } from "next/navigation"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

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
      router.push("/dashboard")
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
        <h1 className="text-xl font-bold">Edit Payment</h1>
        <button 
          onClick={handleDelete}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Delete Payment
        </button>
      </div>
      {error && <p className="text-red-600 mb-4">{error}</p>}
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
            <option value="Credit">Credit</option>
          </select>
        </div>

        <div className="flex gap-4">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Save Changes
          </button>
          <button 
            type="button" 
            onClick={() => router.back()} 
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default function EditPaymentPage({ params }) {
  const unwrappedParams = use(params)
  return (
    <Suspense fallback={<div className="p-6"><Header /><div>Loading...</div></div>}>
      <EditPaymentContent params={unwrappedParams} />
    </Suspense>
  )
} 