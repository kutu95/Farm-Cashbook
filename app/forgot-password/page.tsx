"use client"

import { useState } from "react"
import Link from "next/link"
import AuthFrame from "@/components/AuthFrame"
import Alert from "@/components/Alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/FormField"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.error || "Could not send the reset email. Try again later.")
        return
      }

      setSuccess(true)
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame title="Reset your password" subtitle="We'll email you a link to choose a new password.">
        {success ? (
          <Alert tone="success">Check your email for a link to reset your password.</Alert>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
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
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending reset link..." : "Send reset link"}
            </Button>
          </form>
        )}
        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="font-medium text-green-800 hover:underline">
            Back to sign in
          </Link>
        </div>
    </AuthFrame>
  )
}
