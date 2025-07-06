// /components/Header.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import AdminSubmenu from './AdminSubmenu'
import BooksSubmenu from './BooksSubmenu'

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
            <BooksSubmenu variant="header" isAdmin={isAdmin} />
            <AdminSubmenu isAdmin={isAdmin} variant="header" />
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