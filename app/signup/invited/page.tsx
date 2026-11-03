"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import supabase from "@/lib/supabaseClient"
import AuthFrame from "@/components/AuthFrame"
import Alert from "@/components/Alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/FormField"

function InvitedSignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [validatingToken, setValidatingToken] = useState(true)
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link')
      setValidatingToken(false)
      return
    }

    validateInvitation(token)
  }, [searchParams])

  const validateInvitation = async (token: string) => {
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('email')
        .eq('token', token)
        .single()

      if (error || !data) {
        setError('Invalid or expired invitation link')
        setValidatingToken(false)
        return
      }

      // Check if invitation has expired
      const { data: inviteData } = await supabase
        .from('user_invitations')
        .select('expires_at')
        .eq('token', token)
        .single()

      if (inviteData && new Date(inviteData.expires_at) < new Date()) {
        setError('This invitation has expired')
        setValidatingToken(false)
        return
      }

      setEmail(data.email)
      setValidatingToken(false)
    } catch (err) {
      setError('Error validating invitation')
      setValidatingToken(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `https://books.landlife.au/auth/callback`,
          data: {
            app: 'cashbook'
          }
        }
      })

      if (error) throw error

      // Delete the invitation after successful signup
      const token = searchParams.get('token')
      if (token) {
        await supabase
          .from('user_invitations')
          .delete()
          .eq('token', token)
      }

      router.push('/login?message=Please check your email to confirm your account')
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (validatingToken) {
    return (
      <AuthFrame title="Complete your registration">
        <p className="text-center text-sm text-gray-600">Checking the invitation...</p>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="Complete your registration">
      <form className="space-y-4" onSubmit={handleSignUp}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <FormField id="email" label="Email address">
          <Input id="email" type="email" value={email} disabled />
        </FormField>
        <FormField id="password" label="Password">
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </FormField>
        <FormField id="confirm-password" label="Confirm password">
          <Input
            id="confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </FormField>
        <Button type="submit" className="w-full" disabled={loading || !email}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
        <div className="text-center text-sm">
          <Link href="/login" className="font-medium text-green-800 hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
      </form>
    </AuthFrame>
  )
}

export default function InvitedSignupPage() {
  return (
    <Suspense fallback={
      <AuthFrame title="Complete your registration">
        <p className="text-center text-sm text-gray-600">Loading...</p>
      </AuthFrame>
    }>
      <InvitedSignupContent />
    </Suspense>
  )
} 