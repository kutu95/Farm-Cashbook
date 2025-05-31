"use client"

import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"

export default function LogoutButton() {
  const { supabase } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <button
      onClick={handleLogout}
      className="text-red-600 hover:text-red-800 font-medium"
    >
      Sign Out
    </button>
  )
}