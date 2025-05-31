"use client"

import { useEffect, useState } from "react"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

export default function StatementsPage() {
  const [parties, setParties] = useState<any[]>([])
  const [partyId, setPartyId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [rawExpenses, setRawExpenses] = useState<any[]>([])
  const [rawPayments, setRawPayments] = useState<any[]>([])
  const [error, setError] = useState("")

  useEffect(() => { loadParties() }, [])
  useEffect(() => { if (partyId) loadStatementsForParty(partyId) }, [partyId])

  const loadParties = async () => {
    const { data, error } = await supabase.from("parties").select("*")
    if (error) setError(error.message)
    else setParties(data)
  }

  const loadStatementsForParty = async (partyId: string) => {
    const { data: expenses, error: expError } = await supabase
      .from("expense_allocations")
      .select("allocated_amount, expense:expenses(expense_date, description), party_id")
      .eq("party_id", partyId)
    if (expError) setError(expError.message)
    else setRawExpenses(expenses)

    const { data: payments, error: payError } = await supabase
      .from("payments")
      .select("amount, payment_date, description, source_type, party_id")
      .eq("party_id", partyId)
    if (payError) setError(payError.message)
    else setRawPayments(payments)
  }

  const applyFilters = () => {
    let filteredExpenses = rawExpenses
    let filteredPayments = rawPayments

    filteredExpenses = filteredExpenses.filter(e => {
      const d = new Date(e.expense.expense_date)
      return (!startDate || d >= new Date(startDate)) && (!endDate || d <= new Date(endDate))
    })

    filteredPayments = filteredPayments.filter(p => {
      const d = new Date(p.payment_date)
      return (!startDate || d >= new Date(startDate)) && (!endDate || d <= new Date(endDate))
    })

    const combined = [
      ...filteredExpenses.map(e => ({
        type: "Expense",
        date: e.expense.expense_date,
        description: e.expense.description,
        amount: -e.allocated_amount,
      })),
      ...filteredPayments.map(p => ({
        type: "Payment",
        date: p.payment_date,
        description: `${p.source_type} ${p.description}`.trim(),
        amount: p.amount,
      })),
    ].sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (dateDiff !== 0) return dateDiff
      return a.type === "Expense" ? -1 : 1
    })

    let balance = 0
    return combined.map(r => {
      balance += r.amount
      return { ...r, balance }
    })
  }

  const exportCSV = () => {
    const rows = applyFilters()
    const header = ["Date", "Type", "Description", "Amount", "Balance"]
    const csv = [
      header.join(","),
      ...rows.map(r =>
        [
          r.date,
          r.type,
          `"${r.description}"`,
          r.amount.toFixed(2),
          r.balance.toFixed(2)
        ].join(",")
      ),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "statement.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    alert("PDF export is coming soon 🚀")
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Header />
      <h1 className="text-xl font-bold mb-6">Statements</h1>
      {error && <p className="text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-4 mb-6">
        <select className="border p-2 w-60" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
          <option value="">Select a party (required)</option>
          {parties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <input className="border p-2" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input className="border p-2" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
      </div>

      {partyId && (
        <>
<div className="flex justify-end gap-4 mb-4">
  <button 
    onClick={exportCSV} 
    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow"
  >
    Download CSV
  </button>
  <button 
    onClick={exportPDF} 
    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded shadow"
  >
    Download PDF
  </button>
</div>

          <div className="overflow-x-auto">
            <table className="table-auto w-full border-collapse">
              <thead className="sticky top-0 bg-gray-100">
                <tr>
                  <th className="border px-6 py-3 text-left">Date</th>
                  <th className="border px-6 py-3 text-left">Type</th>
                  <th className="border px-6 py-3 text-left">Description</th>
                  <th className="border px-6 py-3 text-right">Amount</th>
                  <th className="border px-6 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {applyFilters().map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border px-6 py-2">{r.date}</td>
                    <td className="border px-6 py-2">{r.type}</td>
                    <td className="border px-6 py-2">{r.description}</td>
                    <td className="border px-6 py-2 text-right">
                      {r.amount.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
                    </td>
                    <td className="border px-6 py-2 text-right">
                      {r.balance.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}