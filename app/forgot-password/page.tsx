
"use client"

import { useState } from "react"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) setError(error.message)
    else setMessage("Password reset email sent.")
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <Header />
      <h1 className="text-xl font-bold mb-4">Forgot Password</h1>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="Your email" className="border p-2 mb-2 w-full" />
      <button onClick={handleReset} className="bg-blue-600 text-white px-4 py-2 w-full">Send Reset Link</button>
      {message && <p className="text-green-600 mt-2">{message}</p>}
      {error && <p className="text-red-600 mt-2">{error}</p>}
    </div>
  )
}
