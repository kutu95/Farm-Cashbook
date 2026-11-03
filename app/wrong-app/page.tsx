"use client"

import { useAuth } from "@/context/AuthContext"
import AuthFrame from "@/components/AuthFrame"
import { Button } from "@/components/ui/button"

export default function WrongAppPage() {
  const { signOut } = useAuth()

  return (
    <AuthFrame title="This account is not a Farm Cashbook user" subtitle="Farm Cashbook only accepts accounts created for this application.">
      <Button type="button" className="w-full" onClick={() => signOut()}>
        Sign out
      </Button>
    </AuthFrame>
  )
}
