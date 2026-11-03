"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import Alert from "@/components/Alert"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"

interface CashbookUser {
  user_id: string
  role: string
  email: string
  full_name: string | null
  created_at: string | null
  last_sign_in_at: string | null
}

function formatWhen(value: string | null) {
  if (!value) return "Never"
  return new Date(value).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function ManageUsersPage() {
  const { session } = useAuth()
  const [users, setUsers] = useState<CashbookUser[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users")
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch users")
      }
      setUsers(data)
      setError("")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const updateRole = async (userId: string, role: string) => {
    setBusyUserId(userId)
    setError("")
    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update role")
      await fetchUsers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusyUserId(null)
    }
  }

  const removeUser = async (user: CashbookUser) => {
    const label = user.full_name || user.email
    if (!window.confirm(`Remove ${label} from Farm Cashbook? Their login for other applications is left as it is.`)) {
      return
    }

    setBusyUserId(user.user_id)
    setError("")
    try {
      const response = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.user_id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to remove user")
      await fetchUsers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <AppShell>
      <PageFrame
        title="Users"
        description="Farm Cashbook accounts only. People who belong to another application are not listed."
        actions={<Button asChild><Link href="/dashboard/admin/invite">Invite user</Link></Button>}
      >

      {loading ? (
        <p className="text-gray-600">Loading users...</p>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Joined</th>
                <th className="px-3 py-2 font-medium">Last sign in</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.user_id === session?.user?.id
                return (
                  <tr key={user.user_id} className="border-t">
                    <td className="px-3 py-2">{user.full_name || "—"}</td>
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Role for ${user.email}`}
                        className="border rounded px-2 py-1"
                        value={user.role}
                        disabled={busyUserId === user.user_id}
                        onChange={(event) => updateRole(user.user_id, event.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">{formatWhen(user.created_at)}</td>
                    <td className="px-3 py-2">{formatWhen(user.last_sign_in_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-red-700 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-40"
                        disabled={isSelf || busyUserId === user.user_id}
                        onClick={() => removeUser(user)}
                      >
                        {isSelf ? "You" : "Remove"}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-gray-600" colSpan={6}>
                    No Farm Cashbook users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {error ? <Alert tone="error">{error}</Alert> : null}
      </PageFrame>
    </AppShell>
  )
}
