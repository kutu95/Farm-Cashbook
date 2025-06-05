import { ReactNode, useEffect, useState } from 'react'
import LogoutButton from './LogoutButton'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

export default function DashboardShell({ children }: { children: ReactNode }) {
  const { supabase, session } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!session?.user) return

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .single()

      if (!error && data) {
        setIsAdmin(true)
      }
    }

    checkAdminStatus()
  }, [session, supabase])

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: '220px', background: '#f4f4f4', padding: '1rem' }}>
        <h2>Farm Cashbook</h2>
        <nav style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/expenses">Expenses</Link>
          <Link href="/payments">Payments</Link>
          <Link href="/parties">Parties</Link>
          <Link href="/statement">Statements</Link>
          <Link href="/dashboard/profile">Profile</Link>
          {isAdmin && (
            <>
              <Link href="/manage-roles">Manage Roles</Link>
              <Link href="/manage-parties">Manage Parties</Link>
              <Link href="/dashboard/admin/invite">Invite User</Link>
              <Link href="/audit-logs" className="text-blue-600">Audit Logs</Link>
            </>
          )}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <LogoutButton />
        </div>
      </aside>
      <main style={{ flex: 1, padding: '2rem' }}>{children}</main>
    </div>
  )
}
