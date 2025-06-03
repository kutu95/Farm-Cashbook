"use client"

import { useEffect, useState } from "react"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

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
    <div className="p-6 max-w-md mx-auto">
      <Header />
      <h1 className="text-xl font-bold mb-4">Manage Parties</h1>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Party Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter party name"
            className="border p-2 w-full rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Electricity Account Number (Optional)
          </label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
            placeholder="e.g. ABC123456789"
            className="border p-2 w-full rounded-md"
          />
          <p className="text-sm text-gray-500 mt-1">
            Must be 9-12 alphanumeric characters
          </p>
        </div>

        <button 
          onClick={handleAdd} 
          className="bg-blue-600 text-white px-4 py-2 w-full rounded-md hover:bg-blue-700 transition-colors"
        >
          Add Party
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

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
                  <button onClick={saveEdit} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
                    Save
                  </button>
                  <button onClick={cancelEdit} className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500 transition-colors">
                    Cancel
                  </button>
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
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}