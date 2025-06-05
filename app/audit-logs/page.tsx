'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Header from '@/components/Header'
import AuditLogViewer from '@/components/AuditLogViewer'

export default function AuditLogsPage() {
  const { session } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!session) {
      router.push('/login')
    }
  }, [session, router])

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6">
        <Header />
        <AuditLogViewer />
      </div>
    </div>
  )
} 