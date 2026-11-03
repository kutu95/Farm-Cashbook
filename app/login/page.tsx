"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import AuthFrame from "@/components/AuthFrame"
import Alert from "@/components/Alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/FormField"

function LoginContent() {
  const { supabase, session, loading: authLoading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  // Get redirectTo and remove /cashbook prefix if present (for backward compatibility)
  let redirectTo = searchParams.get("redirectTo") || "/dashboard"
  if (redirectTo.startsWith("/cashbook")) {
    redirectTo = redirectTo.replace("/cashbook", "") || "/dashboard"
  }
  const message = searchParams.get("message")

  useEffect(() => {
    // Check if user is already logged in
    if (!authLoading && session) {
      console.log('User already logged in, redirecting to dashboard')
      router.replace("/dashboard")
    }
  }, [session, authLoading, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      console.log('Attempting login for:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Login error:', error)
        setError(error.message)
        return
      }

      if (data?.session) {
        console.log('Login successful, redirecting to:', redirectTo)
        router.replace(redirectTo)
      }
    } catch (err) {
      console.error('Unexpected error during login:', err)
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <AuthFrame title="Sign in">
        <p className="text-center text-sm text-gray-600">Loading...</p>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="Sign in">
      <form className="space-y-4" onSubmit={handleLogin}>
        {message ? <Alert tone="success">{message}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <FormField id="email-address" label="Email address">
          <Input
            id="email-address"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField id="password" label="Password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="font-medium text-green-800 hover:underline">
            Forgot your password?
          </Link>
          <Link href="/signup" className="font-medium text-green-800 hover:underline">
            Create an account
          </Link>
        </div>
      </form>
    </AuthFrame>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthFrame title="Sign in">
        <p className="text-center text-sm text-gray-600">Loading...</p>
      </AuthFrame>
    }>
      <LoginContent />
    </Suspense>
  )
}
