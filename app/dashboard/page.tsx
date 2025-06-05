"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/Header"
import { PlusCircle, DollarSign, Users, Shield, FileText } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"

export default function DashboardPage() {
  const { supabase, session } = useAuth()
  const router = useRouter()
  const [partyBalances, setPartyBalances] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  const checkAdminStatus = async () => {
    if (!session?.user?.id) {
      console.log('No user session')
      setIsAdmin(false)
      return
    }

    try {
      // Log the current session state
      console.log('Checking admin status with session:', {
        userId: session.user.id,
        email: session.user.email
      })

      // Now check for the specific user's role
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (error) {
        console.error('Error checking specific user role:', error)
        setIsAdmin(false)
        return
      }

      console.log('Role check result:', { data, userId: session.user.id })

      if (!data) {
        console.log('No role found for user, defaulting to non-admin')
        setIsAdmin(false)
        return
      }

      const isUserAdmin = data.role === 'admin'
      console.log('Admin status determined:', { isUserAdmin, roleData: data })
      setIsAdmin(isUserAdmin)
    } catch (err) {
      console.error('Error in checkAdminStatus:', err)
      setIsAdmin(false)
    }
  }

  const loadBalances = async () => {
    if (!session?.user) return

    try {
      // Get all parties with their total payments and expenses in a single query
      const { data: balances, error } = await supabase
        .from('parties')
        .select(`
          id,
          name,
          payments:payments(amount),
          expense_allocations:expense_allocations(allocated_amount)
        `)

      if (error) {
        console.error('Error loading balances:', error)
        return
      }

      // Calculate balances for each party
      const calculatedBalances = balances.map(party => {
        const totalPayments = (party.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
        const totalExpenses = (party.expense_allocations || []).reduce((sum, e) => sum + (e.allocated_amount || 0), 0)
        
        return {
          id: party.id,
          name: party.name,
          balance: totalPayments - totalExpenses
        }
      })

      setPartyBalances(calculatedBalances)
    } catch (err) {
      console.error('Error in loadBalances:', err)
    }
  }

  // Combine admin check and balance loading into a single effect
  useEffect(() => {
    const initializeDashboard = async () => {
      console.log('Session changed:', { hasUser: !!session?.user })
      if (session?.user) {
        await checkAdminStatus()
        await loadBalances()
      } else {
        setIsAdmin(false)
        setPartyBalances([])
      }
    }

    initializeDashboard()
  }, [session]) // We don't need to include checkAdminStatus and loadBalances as they're defined inside the component

  useEffect(() => {
    console.log('isAdmin state changed:', isAdmin)
  }, [isAdmin])

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
            <Link 
              href="/add-payment" 
              className="flex items-center bg-blue-500 text-white px-4 py-2 rounded"
              onClick={() => console.log('Navigating to add payment')}
            >
              <DollarSign className="mr-2" /> Add Payment
            </Link>
            <Link 
              href="/add-expense" 
              className="flex items-center bg-green-500 text-white px-4 py-2 rounded"
              onClick={() => console.log('Navigating to add expense')}
            >
              <PlusCircle className="mr-2" /> Add Expense
            </Link>
            <Link 
              href="/manage-parties" 
              className="flex items-center bg-purple-500 text-white px-4 py-2 rounded"
              onClick={() => console.log('Navigating to manage parties')}
            >
              <Users className="mr-2" /> Manage Parties
            </Link>
            <Link 
              href="/manage-roles" 
              className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded"
              onClick={() => console.log('Navigating to manage roles')}
            >
              <Shield className="mr-2" /> Manage Roles
            </Link>
            <Link 
              href="/dashboard/admin/invite" 
              className="flex items-center bg-indigo-500 text-white px-4 py-2 rounded"
              onClick={() => console.log('Navigating to invite user')}
            >
              <Users className="mr-2" /> Invite User
            </Link>
          </>
        )}
        <Link 
          href="/statements" 
          className="flex items-center bg-gray-500 text-white px-4 py-2 rounded"
          onClick={() => console.log('Navigating to statements')}
        >
          <FileText className="mr-2" /> Statements
        </Link>
      </div>
    </div>
  )
}