// /components/Header.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Header() {
  const router = useRouter()
  const { session, signOut } = useAuth()

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem' }}>
      <Link href="/"><strong>Farm Cashbook</strong></Link>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        {session ? (
          <>
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