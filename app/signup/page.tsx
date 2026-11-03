"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import supabase from "@/lib/supabaseClient"
import AuthFrame from "@/components/AuthFrame"
import Alert from "@/components/Alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/FormField"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

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

      setSuccess(true)
      setEmail('')
      setPassword('')
      router.push('/login?message=Please check your email to confirm your account')
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame title="Create an account">
        <form className="space-y-4" onSubmit={handleSignUp}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          {success ? <Alert tone="success">Please check your email to confirm your account.</Alert> : null}
          <FormField id="email" label="Email address">
            <Input
              id="email"
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
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <Button type="submit" disabled={loading} className="w-full">
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
