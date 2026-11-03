"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import supabase from "@/lib/supabaseClient"
import AuthFrame from "@/components/AuthFrame"
import Alert from "@/components/Alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/FormField"

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const tokenHash = searchParams.get("token_hash")
  const hasRecoveryToken = Boolean(
    tokenHash && searchParams.get("type") === "recovery" && tokenHash.length <= 2048
  )

  useEffect(() => {
    let active = true
    const confirmed = window.sessionStorage.getItem("farm-cashbook-recovery") === "1"

    // A recovery link has to be confirmed before it replaces any current session.
    // Once confirmed, the flag survives a refresh that still has the token in the URL.
    if (hasRecoveryToken && !confirmed) {
      setHasSession(false)
      setCheckingSession(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setHasSession(Boolean(data.session))
      setCheckingSession(false)
    }).catch(() => {
      if (!active) return
      setHasSession(false)
      setCheckingSession(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setHasSession(true)
        setCheckingSession(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [hasRecoveryToken])

  const confirmReset = async () => {
    if (!tokenHash) return

    setConfirming(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/confirm-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: tokenHash }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.error || "This reset link is invalid or has expired.")
        return
      }

      window.sessionStorage.setItem("farm-cashbook-recovery", "1")
      const url = new URL(window.location.href)
      url.searchParams.delete("token_hash")
      url.searchParams.delete("type")
      window.history.replaceState(null, "", `${url.pathname}${url.search}`)
      setHasSession(true)
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setConfirming(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(result.error || "Could not update the password. Request a new reset link and try again.")
        return
      }

      window.sessionStorage.removeItem("farm-cashbook-recovery")
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  const subtitle = !checkingSession && !hasSession && hasRecoveryToken
    ? "Opening the email does not use the link until you continue."
    : undefined

  return (
    <AuthFrame title="Reset your password" subtitle={subtitle}>
      {checkingSession ? <p className="text-center text-sm text-gray-600">Loading...</p> : null}

      {!checkingSession && !hasSession && hasRecoveryToken ? (
        <div className="space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button type="button" className="w-full" disabled={confirming} onClick={confirmReset}>
            {confirming ? "Continuing..." : "Continue"}
          </Button>
          {error ? (
            <Button type="button" variant="outline" className="w-full" asChild>
              <Link href="/forgot-password">Send a new reset link</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {!checkingSession && !hasSession && !hasRecoveryToken ? (
        <div className="space-y-4">
          <Alert tone="error">This reset link is missing or has expired. Request a new one.</Alert>
          <Button type="button" className="w-full" asChild>
            <Link href="/forgot-password">Send reset link</Link>
          </Button>
        </div>
      ) : null}

      {!checkingSession && hasSession ? (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <FormField id="password" label="New password">
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField id="confirmPassword" label="Confirm new password">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </FormField>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Resetting password..." : "Reset password"}
          </Button>
        </form>
      ) : null}
    </AuthFrame>
  )
}

function LoadingFallback() {
  return (
    <AuthFrame title="Reset your password">
      <p className="text-center text-sm text-gray-600">Loading...</p>
    </AuthFrame>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
