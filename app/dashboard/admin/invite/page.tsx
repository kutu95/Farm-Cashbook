"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import EmptyState from "@/components/EmptyState"
import Alert from "@/components/Alert"
import { Button } from "@/components/ui/button"
import { fieldControlClass, FormField } from "@/components/FormField"

export default function InviteUserPage() {
  const router = useRouter()
  const { session, supabase } = useAuth()
  
  // Group all useState hooks together
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Combine all auth and admin checks into a single useEffect
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!session?.user) {
          console.log('No session, redirecting to login')
          router.push('/login')
          return
        }

        // Check admin status
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()

        console.log('Admin check:', {
          roleData,
          roleError,
          isAdmin: roleData?.role === 'admin'
        })

        if (roleError) {
          console.error('Error checking admin status:', roleError)
          setError('Error checking admin status')
          router.push('/dashboard')
          return
        }

        if (!roleData || roleData.role !== 'admin') {
          console.log('User is not admin, redirecting to dashboard')
          router.push('/dashboard')
          return
        }

        setIsAdmin(true)
      } catch (err) {
        console.error('Error in auth check:', err)
        setError('Error checking authentication status')
        router.push('/dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [session, router, supabase])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      console.log('Starting invitation process for:', email)
      
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email }),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        })
        throw new Error(errorData.error || errorData.details || 'Failed to send invitation')
      }

      const data = await response.json()
      console.log('API Response:', { 
        status: response.status, 
        ok: response.ok,
        data 
      })

      setSuccess(true)
      setEmail('')
    } catch (err: any) {
      console.error('Error in handleInvite:', err)
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <AppShell>
        <EmptyState title="Loading" />
      </AppShell>
    )
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <EmptyState title="Admin access required" description="Only an admin can invite someone to Farm Cashbook." />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageFrame title="Invite" width="3xl" description="Send an invitation to a new Farm Cashbook account.">

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleInvite} className="space-y-6">
            {error ? <Alert tone="error">{error}</Alert> : null}
            {success ? <Alert tone="success">Invitation sent.</Alert> : null}

            <FormField id="email" label="Email address">
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldControlClass}
                placeholder="Enter email address"
              />
            </FormField>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending invitation..." : "Send invitation"}
            </Button>
          </form>
        </div>
      </PageFrame>
    </AppShell>
  )
} 