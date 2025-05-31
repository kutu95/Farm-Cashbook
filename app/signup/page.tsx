
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import supabase from "@/lib/supabaseClient"

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else router.replace("/login")
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Sign Up</h1>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="Email" className="border p-2 mb-2 w-full" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Password" className="border p-2 mb-2 w-full" />
      <button onClick={handleSignup} className="bg-green-600 text-white px-4 py-2 w-full">Sign Up</button>
      {error && <p className="text-red-600 mt-2">{error}</p>}
      <p className="mt-4 text-center">Already have an account? <a href="/login" className="text-blue-600 underline">Login</a></p>
    </div>
  )
}
