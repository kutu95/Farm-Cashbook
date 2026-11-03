// app/manage-roles/page.tsx

"use client"

import { useEffect, useState } from "react"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import Alert from "@/components/Alert"
import { Button } from "@/components/ui/button"

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
    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: 'admin' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update role')
      fetchUsers()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <AppShell>
      <PageFrame title="Roles" width="3xl" description="Promote a Farm Cashbook user to admin.">
      <p className="text-sm text-gray-600 mb-4">Farm Cashbook accounts only.</p>

      <h2 className="font-bold mb-2">User Roles:</h2>
      <ul className="space-y-2">
        {users.map(user => (
          <li key={user.user_id} className="border p-2 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.email}</span>
              <span className="text-xs text-gray-500">Role: {user.role}</span>
            </div>
            {user.role !== "admin" && (
              <Button type="button" size="sm" onClick={() => handlePromote(user.user_id)}>
                Promote to admin
              </Button>
            )}
          </li>
        ))}
      </ul>

      {error ? <Alert tone="error">{error}</Alert> : null}
      </PageFrame>
    </AppShell>
  )
}