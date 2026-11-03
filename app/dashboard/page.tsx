"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import EmptyState from "@/components/EmptyState"
import Alert from "@/components/Alert"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/format"

export default function DashboardPage() {
  const { supabase, session } = useAuth()
  const [partyBalances, setPartyBalances] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loadingBalances, setLoadingBalances] = useState(true)
  const [balanceError, setBalanceError] = useState("")

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

    setLoadingBalances(true)
    setBalanceError("")
    try {
      const { data: balances, error } = await supabase
        .from('parties')
        .select(`
          id,
          name,
          payments:payments(amount),
          expense_allocations:expense_allocations(allocated_amount)
        `)

      if (error) {
        setBalanceError("Could not load party balances.")
        return
      }

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
      setBalanceError("Could not load party balances.")
    } finally {
      setLoadingBalances(false)
    }
  }

  const positions = partyBalances.map((party) => ({
    ...party,
    owes: -party.balance,
  }))
  const totalOwed = positions.reduce((sum, party) => sum + Math.max(0, party.owes), 0)
  const totalCredit = positions.reduce((sum, party) => sum + Math.max(0, -party.owes), 0)
  const netOwed = totalOwed - totalCredit
  const partiesInDebit = positions.filter((party) => party.owes > 0.004).length

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
        setLoadingBalances(false)
      }
    }

    initializeDashboard()
  }, [session]) // We don't need to include checkAdminStatus and loadBalances as they're defined inside the component

  useEffect(() => {
    console.log('isAdmin state changed:', isAdmin)
  }, [isAdmin])

  return (
    <AppShell>
      <PageFrame
        title="Dashboard"
        description="A party owes the farm when charges are higher than payments. In credit means they have paid more than they have been charged. Net owed is what is still due after credits."
        actions={isAdmin ? (
          <>
            <Button asChild>
              <Link href="/add-expense">Add expense</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/add-payment">Add payment</Link>
            </Button>
          </>
        ) : null}
      >
        {balanceError ? <Alert tone="error">{balanceError}</Alert> : null}

        {isAdmin ? (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-medium text-gray-500">Admin</h2>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm"><Link href="/manage-parties">Parties</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href="/manage-users">Users</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href="/manage-roles">Roles</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href="/audit-logs">Audit logs</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href="/publishing">Publishing</Link></Button>
            </div>
          </div>
        ) : null}

        {session ? <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">{netOwed >= 0 ? "Net owed to farm" : "Net credit with parties"}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{formatMoney(Math.abs(netOwed))}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Parties in debit</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{partiesInDebit}</p>
          </div>
          <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-4 lg:col-span-1">
            <p className="text-sm text-gray-600">Charged, still unpaid</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{formatMoney(totalOwed)}</p>
            <p className="mt-1 text-xs text-gray-500">Credits held: {formatMoney(totalCredit)}</p>
          </div>
        </div> : null}

        {!session ? (
          <EmptyState title="Sign in to see balances" action={<Button asChild><Link href="/login">Sign in</Link></Button>} />
        ) : loadingBalances ? (
          <EmptyState title="Loading balances" />
        ) : positions.length === 0 ? (
          <EmptyState title="No parties yet" description="Add a party before recording expenses and payments." action={isAdmin ? <Button asChild><Link href="/manage-parties">Manage parties</Link></Button> : undefined} />
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-left font-medium">Party</th>
                  <th className="px-3 py-2 text-right font-medium">Owes the farm</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((party) => (
                  <tr key={party.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="sticky left-0 bg-white px-3 py-2">
                      <Link href={`/statements?party=${party.id}`} className="font-medium text-green-800 underline-offset-2 hover:underline">
                        {party.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {party.owes > 0.004
                        ? formatMoney(party.owes)
                        : party.owes < -0.004
                          ? `In credit ${formatMoney(-party.owes)}`
                          : formatMoney(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50 font-medium">
                  <td className="sticky left-0 bg-gray-50 px-3 py-2">Net owed to farm</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(netOwed)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </PageFrame>
    </AppShell>
  )
}