import { ReactNode, useEffect, useState } from 'react'
import LogoutButton from './LogoutButton'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import AdminSubmenu from './AdminSubmenu'
import BooksSubmenu from './BooksSubmenu'

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
          <BooksSubmenu variant="sidebar" isAdmin={isAdmin} />
          <Link href="/dashboard/profile">Profile</Link>
          <AdminSubmenu isAdmin={isAdmin} variant="sidebar" />
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <LogoutButton />
        </div>
      </aside>
      <main style={{ flex: 1, padding: '2rem' }}>{children}</main>
    </div>
  )
}
