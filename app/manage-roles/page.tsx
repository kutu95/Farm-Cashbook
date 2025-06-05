// app/manage-roles/page.tsx

"use client"

import { useEffect, useState } from "react"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

interface User {
  user_id: string
  role: string
  email: string
}

export default function ManageRolesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch users')
      }
      const data = await response.json()
      setUsers(data)
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err.message)
    }
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
          <li key={user.user_id} className="border p-2 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.email}</span>
              <span className="text-xs text-gray-500">Role: {user.role}</span>
            </div>
            {user.role !== "admin" && (
              <button
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
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