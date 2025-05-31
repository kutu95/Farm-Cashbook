
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.replace("/dashboard")
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Login</h1>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="Email" className="border p-2 mb-2 w-full" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Password" className="border p-2 mb-2 w-full" />
      <button onClick={handleLogin} className="bg-blue-600 text-white px-4 py-2 w-full">Login</button>
      {error && <p className="text-red-600 mt-2">{error}</p>}
      <p className="mt-4 text-center">Don't have an account? <a href="/signup" className="text-blue-600 underline">Sign up</a></p>
    </div>
  )
}
