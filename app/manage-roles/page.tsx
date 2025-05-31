// app/manage-roles/page.tsx

"use client"

import { useEffect, useState } from "react"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

export default function ManageRolesPage() {
  const [users, setUsers] = useState<any[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    const { data, error } = await supabase.from("user_roles").select("user_id, role")
    if (error) setError(error.message)
    else setUsers(data)
  }

  const handlePromote = async (userId: string) => {
    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" })

    if (error) setError(error.message)
    else fetchUsers()
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <Header />
      <h1 className="text-xl font-bold mb-4">Manage Roles</h1>

      <h2 className="font-bold mb-2">User Roles:</h2>
      <ul className="space-y-2">
        {users.map(user => (
          <li key={user.user_id} className="border p-2 flex justify-between">
            <span>{user.user_id}</span>
            <span>{user.role}</span>
            {user.role !== "admin" && (
              <button
                className="text-blue-600 underline"
                onClick={() => handlePromote(user.user_id)}
              >
                Promote to Admin
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="text-red-600 mt-2">{error}</p>}
    </div>
  )
}