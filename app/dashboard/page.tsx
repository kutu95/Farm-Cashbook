"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"
import { PlusCircle, DollarSign, Users, Shield, FileText, UserPlus } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const router = useRouter()
  const [partyBalances, setPartyBalances] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBalances()
    checkAdmin()
  }, [router])

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      setIsAdmin(roleData?.role === 'admin')
      setLoading(false)
    } catch (error) {
      console.error('Error checking admin status:', error)
      setLoading(false)
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

  if (loading) {
    return <div>Loading...</div>
  }

  if (isAdmin) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">User Management</h2>
            <button
              onClick={() => router.push('/dashboard/admin/invite')}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Invite User
            </button>
          </div>
          {/* Add more admin features here */}
        </div>
      </div>
    )
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
          </>
        )}
        <Link href="/statements" className="flex items-center bg-gray-500 text-white px-4 py-2 rounded">
          <FileText className="mr-2" /> Statements
        </Link>
      </div>
    </div>
  )
}