"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import Header from "@/components/Header"

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
      <div className="p-6 max-w-2xl mx-auto">
        <Header />
        <div className="mt-8 text-center">
          Loading...
        </div>
      </div>
    )
  }

  // Non-admin state
  if (!isAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Header />
        <div className="mt-8 text-center">
          Redirecting...
        </div>
      </div>
    )
  }

  // Main render
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Header />
      <div className="mt-8">
        <h1 className="text-2xl font-bold mb-6">Invite New User</h1>

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleInvite} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">
                  Invitation sent successfully!
                </span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter email address"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? "Sending invitation..." : "Send Invitation"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
} 