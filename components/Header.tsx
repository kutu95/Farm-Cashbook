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
    <header style={{ paddingBottom: '1rem' }}>
      {/* Logo and title - always on top */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: '1rem',
        padding: '0.5rem 0'
      }}>
        <Link href="/dashboard" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          textDecoration: 'none', 
          color: 'inherit' 
        }}>
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/icon-192.png`} alt="Farm Cashbook Logo" style={{ width: '32px', height: '32px' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a' }}>Farm Cashbook</span>
        </Link>
      </div>
      
      {/* Navigation menu - below logo on mobile, side by side on desktop */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        {session ? (
          <>
            <BooksSubmenu variant="header" isAdmin={isAdmin} />
            <AdminSubmenu isAdmin={isAdmin} variant="header" />
            <Link href="/dashboard/profile" style={{ 
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              textDecoration: 'none',
              fontSize: '0.875rem'
            }}>My Profile</Link>
            <button 
              onClick={signOut} 
              style={{ 
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" style={{ 
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.875rem'
            }}>Login</Link>
            <Link href="/signup" style={{ 
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              backgroundColor: '#10b981',
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.875rem'
            }}>Signup</Link>
          </>
        )}
      </div>
    </header>
  )
}