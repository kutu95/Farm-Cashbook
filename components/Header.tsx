// /components/Header.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Header() {
  const router = useRouter()
  const { session, signOut, supabase } = useAuth()
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
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem' }}>
      <Link href="/"><strong>Farm Cashbook</strong></Link>
      <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {session ? (
          <>
            {isAdmin && (
              <>
                <Link href="/manage-roles">Manage Roles</Link>
                <Link href="/manage-parties">Manage Parties</Link>
                <Link href="/dashboard/admin/invite">Invite User</Link>
                <Link href="/audit-logs" style={{ color: '#2563eb' }}>Audit Logs</Link>
              </>
            )}
            <Link href="/dashboard/profile">My Profile</Link>
            <button 
              onClick={signOut} 
              style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer' }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Login</Link>
            <Link href="/signup">Signup</Link>
          </>
        )}
      </nav>
    </header>
  )
}