"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import supabase from "@/lib/supabaseClient"

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset Your Password
          </h2>
          {!checkingSession && !hasSession && hasRecoveryToken && (
            <p className="mt-2 text-center text-sm text-gray-600">
              Continue to choose a new password. Opening the email does not use the link until you do.
            </p>
          )}
        </div>

        {checkingSession && (
          <div className="text-center text-sm text-gray-600">Loading...</div>
        )}

        {!checkingSession && !hasSession && hasRecoveryToken && (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}
            <button
              type="button"
              disabled={confirming}
              onClick={confirmReset}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {confirming ? "Continuing..." : "Continue"}
            </button>
            {error && (
              <Link
                href="/forgot-password"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Send a new reset link
              </Link>
            )}
          </div>
        )}

        {!checkingSession && !hasSession && !hasRecoveryToken && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
              <span className="block sm:inline">
                This reset link is missing or has expired. Request a new one.
              </span>
            </div>
            <Link
              href="/forgot-password"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Send reset link
            </Link>
          </div>
        )}

        {!checkingSession && hasSession && (
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? "Resetting password..." : "Reset Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">Loading...</h2>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
