"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"
import { PlusCircle, DollarSign, Users, Shield, FileText } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"

export default function DashboardPage() {
  const { session } = useAuth()
  const router = useRouter()
  const [partyBalances, setPartyBalances] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    loadBalances()
    if (session?.user) {
      checkAdminStatus()
    }
  }, [session])

  const checkAdminStatus = async () => {
    if (!session?.user?.id) {
      console.log('No user session')
      return
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

      if (!error && data) {
        setIsAdmin(data.role === 'admin')
      }
    } catch (err) {
      console.error('Error checking admin status:', err)
    }
  }

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
        id: party.id,
        name: party.name,
        balance: totalPayments - totalExpenses
      })
    }

    setPartyBalances(balances)
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <Header />
      <h1 className="text-xl font-bold mb-4">Dashboard</h1>

      <table className="table-auto w-full border-collapse mb-6">
        <thead>
          <tr>
            <th className="border px-2 py-1 text-left">Party</th>
            <th className="border px-2 py-1 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {partyBalances.map((p, i) => (
            <tr key={i}>
              <td className="border px-2 py-1">
                <Link 
                  href={`/statements?party=${p.id}`}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {p.name}
                </Link>
              </td>
              <td className={`border px-2 py-1 text-right ${p.balance < 0 ? 'text-red-600' : 'text-black'}`}>
                {p.balance.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap gap-4">
        {isAdmin && (
          <>
            <Link href="/add-payment" className="flex items-center bg-blue-500 text-white px-4 py-2 rounded">
              <DollarSign className="mr-2" /> Add Payment
            </Link>
            <Link href="/add-expense" className="flex items-center bg-green-500 text-white px-4 py-2 rounded">
              <PlusCircle className="mr-2" /> Add Expense
            </Link>
            <Link href="/manage-parties" className="flex items-center bg-purple-500 text-white px-4 py-2 rounded">
              <Users className="mr-2" /> Manage Parties
            </Link>
            <Link href="/manage-roles" className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded">
              <Shield className="mr-2" /> Manage Roles
            </Link>
            <Link href="/dashboard/admin/invite" className="flex items-center bg-indigo-500 text-white px-4 py-2 rounded">
              <Users className="mr-2" /> Invite User
            </Link>
          </>
        )}
        <Link href="/statements" className="flex items-center bg-gray-500 text-white px-4 py-2 rounded">
          <FileText className="mr-2" /> Statements
        </Link>
      </div>
    </div>
  )
}