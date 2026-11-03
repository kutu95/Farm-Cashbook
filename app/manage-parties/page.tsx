"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import supabase from "@/lib/supabaseClient"
import AppShell from "@/components/AppShell"
import PageFrame from "@/components/PageFrame"
import Alert from "@/components/Alert"
import { fieldControlClass, FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"

interface Party {
  id: string
  name: string
  electricity_account_number?: string
}

export default function ManagePartiesPage() {
  const [parties, setParties] = useState<Party[]>([])
  const [name, setName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [error, setError] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingAccountNumber, setEditingAccountNumber] = useState("")

  useEffect(() => {
    fetchParties()
  }, [])

  const fetchParties = async () => {
    const { data, error } = await supabase.from("parties").select("id, name, electricity_account_number")
    if (error) {
      setError(error.message)
    } else {
      setParties(data)
    }
  }

  const validateAccountNumber = (number: string) => {
    if (!number) return true // Allow empty for optional field
    if (number.length < 9 || number.length > 12) return false
    return /^[A-Za-z0-9]+$/.test(number)
  }

  const handleAdd = async () => {
    if (!name) {
      setError("Party name is required.")
      return
    }

    if (accountNumber && !validateAccountNumber(accountNumber)) {
      setError("Electricity account number must be 9-12 alphanumeric characters.")
      return
    }

    const { error: insertError } = await supabase.from("parties").insert({ 
      name,
      electricity_account_number: accountNumber || null
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setName("")
      setAccountNumber("")
      fetchParties()
    }
  }

  const startEdit = (party: Party) => {
    setEditingId(party.id)
    setEditingName(party.name)
    setEditingAccountNumber(party.electricity_account_number || "")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName("")
    setEditingAccountNumber("")
  }

  const saveEdit = async () => {
    if (!editingName) {
      setError("Party name cannot be empty.")
      return
    }

    if (editingAccountNumber && !validateAccountNumber(editingAccountNumber)) {
      setError("Electricity account number must be 9-12 alphanumeric characters.")
      return
    }

    const { error: updateError } = await supabase
      .from("parties")
      .update({ 
        name: editingName,
        electricity_account_number: editingAccountNumber || null
      })
      .eq("id", editingId)

    if (updateError) {
      setError(updateError.message)
    } else {
      cancelEdit()
      fetchParties()
    }
  }

  return (
    <AppShell>
      <PageFrame
        title="Parties"
        description="People and businesses the cashbook splits expenses across."
        actions={<Button variant="outline" asChild><Link href="/dashboard">Back</Link></Button>}
      >
      <div className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <FormField id="party-name" label="Party name">
          <input
            id="party-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter party name"
            className={fieldControlClass}
          />
        </FormField>
        <FormField id="account-number" label="Electricity account number" hint="Optional. 9–12 letters or numbers.">
          <input
            id="account-number"
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
            placeholder="e.g. ABC123456789"
            className={fieldControlClass}
          />
        </FormField>
        <Button type="button" onClick={handleAdd}>Add party</Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <h2 className="font-bold mb-2">Existing Parties:</h2>
      <ul className="space-y-4">
        {parties.map((p) => (
          <li key={p.id} className="border rounded-md p-4">
            {editingId === p.id ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Party Name
                  </label>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="border p-2 w-full rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Electricity Account Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={editingAccountNumber}
                    onChange={(e) => setEditingAccountNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC123456789"
                    className="border p-2 w-full rounded-md"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Must be 9-12 alphanumeric characters
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={saveEdit}>Save</Button>
                  <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{p.name}</h3>
                    {p.electricity_account_number && (
                      <p className="text-sm text-gray-600">
                        Account: {p.electricity_account_number}
                      </p>
                    )}
                  </div>
                  <button 
                    onClick={() => startEdit(p)} 
                    className="text-green-800 underline-offset-2 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      </PageFrame>
    </AppShell>
  )
}