"use client"

import { useEffect, useState } from "react"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"
import { PlusCircle, DollarSign, Users, Shield, FileText } from "lucide-react"

export default function DashboardPage() {
  const [partyBalances, setPartyBalances] = useState<any[]>([])

  useEffect(() => {
    loadBalances()
  }, [])

  const loadBalances = async () => {
    const { data: parties } = await supabase.from("parties").select("id, name")
    const balances = []

    for (const party of parties || []) {
      const { data: payments } = await supabase
        .from("payments")
        .select("amount")
        .eq("party_id", party.id)
      const totalPayments = payments?.reduce((sum, p) => sum + p.amount, 0) || 0

      const { data: allocations } = await supabase
        .from("expense_allocations")
        .select("allocated_amount")
        .eq("party_id", party.id)
      const totalExpenses = allocations?.reduce((sum, a) => sum + a.allocated_amount, 0) || 0

      balances.push({
        name: party.name,
        balance: totalPayments - totalExpenses
      })
    }

    setPartyBalances(balances)
  }

  return (
    <div className="p-6">
      <Header />
      <h1 className="text-xl font-bold mb-4">Dashboard</h1>

<table className="table-auto w-full border-collapse mb-6">
  <thead>
    <tr>
      <th className="border px-2 py-1">Party</th>
      <th className="border px-2 py-1 text-right">Balance</th>
    </tr>
  </thead>
  <tbody>
    {partyBalances.map((p, i) => (
      <tr key={i}>
        <td className="border px-2 py-1">{p.name}</td>
        <td className="border px-2 py-1 text-right">
          {p.balance.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
        </td>
      </tr>
    ))}
  </tbody>
</table>

      <div className="flex flex-wrap gap-4">
        <a href="/add-payment" className="flex items-center bg-blue-500 text-white px-4 py-2 rounded">
          <DollarSign className="mr-2" /> Add Payment
        </a>
        <a href="/add-expense" className="flex items-center bg-green-500 text-white px-4 py-2 rounded">
          <PlusCircle className="mr-2" /> Add Expense
        </a>
        <a href="/manage-parties" className="flex items-center bg-purple-500 text-white px-4 py-2 rounded">
          <Users className="mr-2" /> Manage Parties
        </a>
        <a href="/manage-roles" className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded">
          <Shield className="mr-2" /> Manage Roles
        </a>
        <a href="/statements" className="flex items-center bg-gray-500 text-white px-4 py-2 rounded">
          <FileText className="mr-2" /> Statements
        </a>
      </div>
    </div>
  )
}