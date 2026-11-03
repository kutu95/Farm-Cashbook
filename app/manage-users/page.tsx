"use client"

import { FormEvent, useEffect, useState } from "react"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import Alert from "@/components/Alert"
import { Button } from "@/components/ui/button"
import { fieldControlClass, FormField } from "@/components/FormField"
import { useAuth } from "@/context/AuthContext"

interface CashbookUser {
  user_id: string
  role: string
  email: string
  full_name: string | null
  created_at: string | null
  last_sign_in_at: string | null
  parties: string[]
}

interface Party {
  id: string
  name: string
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
  const { session, supabase } = useAuth()
  const [users, setUsers] = useState<CashbookUser[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("user")
  const [partyIds, setPartyIds] = useState<string[]>([])
  const [sendInstructions, setSendInstructions] = useState(false)

  const fetchUsers = async () => {
    const response = await fetch("/api/users")
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Failed to fetch users")
    setUsers(data)
  }

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error: partyError } = await supabase.from("parties").select("id, name").order("name")
        if (partyError) throw partyError
        setParties(data || [])
        await fetchUsers()
        setError("")
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load users")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  const toggleParty = (partyId: string) => {
    setPartyIds((current) =>
      current.includes(partyId) ? current.filter((id) => id !== partyId) : [...current, partyId]
    )
  }

  const createUser = async (event: FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, role, partyIds, sendInstructions }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not create the user")
      await fetchUsers()
      setFullName("")
      setEmail("")
      setRole("user")
      setPartyIds([])
      setSendInstructions(false)
      if (sendInstructions && data.emailSent) {
        setNotice(`Account created. A link to choose a password was sent to ${email}.`)
      } else if (sendInstructions && data.emailError) {
        setNotice("Account created.")
        setError(`The account exists, but the email was not sent. ${data.emailError}`)
      } else {
        setNotice("Account created. Send a login link when you want them to choose a password.")
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create the user")
    } finally {
      setCreating(false)
    }
  }

  const updateRole = async (userId: string, nextRole: string) => {
    setBusyUserId(userId)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: nextRole }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update role")
      await fetchUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update role")
    } finally {
      setBusyUserId(null)
    }
  }

  const sendLoginLink = async (user: CashbookUser) => {
    setBusyUserId(user.user_id)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.user_id, sendInstructions: true }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not send the email")
      setNotice(`A link to choose a password was sent to ${user.email}.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send the email")
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
    setNotice("")
    try {
      const response = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.user_id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to remove user")
      await fetchUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove user")
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <AppShell>
      <PageFrame
        title="Users"
        description="Create a Farm Cashbook account, choose the parties they receive statements for, and email a password link when you are ready."
      >
        <form onSubmit={createUser} className="mb-8 space-y-4 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">Create user</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="full-name" label="Name">
              <input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} className={fieldControlClass} />
            </FormField>
            <FormField id="email" label="Email">
              <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={fieldControlClass} autoComplete="off" />
            </FormField>
          </div>
          <FormField id="role" label="Role">
            <select id="role" value={role} onChange={(event) => setRole(event.target.value)} className={fieldControlClass}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>
          {parties.length > 0 ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-gray-700">Monthly statements</legend>
              <div className="space-y-2">
                {parties.map((party) => (
                  <label key={party.id} className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={partyIds.includes(party.id)}
                      onChange={() => toggleParty(party.id)}
                    />
                    {party.name}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-sm text-gray-500">Each selected party is included when monthly statements are sent.</p>
            </fieldset>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={sendInstructions}
              onChange={(event) => setSendInstructions(event.target.checked)}
            />
            Email a link to choose a password
          </label>
          <Button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create user"}
          </Button>
        </form>

        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}

        {loading ? (
          <p className="text-sm text-gray-600">Loading users...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Statements</th>
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
                          className="rounded border px-2 py-1"
                          value={user.role}
                          disabled={busyUserId === user.user_id}
                          onChange={(event) => updateRole(user.user_id, event.target.value)}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">{user.parties.length > 0 ? user.parties.join(", ") : "—"}</td>
                      <td className="px-3 py-2">{formatWhen(user.created_at)}</td>
                      <td className="px-3 py-2">{formatWhen(user.last_sign_in_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyUserId === user.user_id}
                            onClick={() => sendLoginLink(user)}
                          >
                            Send login link
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isSelf || busyUserId === user.user_id}
                            onClick={() => removeUser(user)}
                          >
                            {isSelf ? "You" : "Remove"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {users.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-gray-600" colSpan={7}>
                      No Farm Cashbook users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </PageFrame>
    </AppShell>
  )
}
