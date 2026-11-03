'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppShell from '@/components/AppShell'
import PageFrame from '@/components/PageFrame'
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
    <AppShell>
      <PageFrame title="Audit logs">
        <AuditLogViewer />
      </PageFrame>
    </AppShell>
  )
} 