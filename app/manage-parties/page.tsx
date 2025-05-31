"use client"

import { useEffect, useState } from "react"
import supabase from "@/lib/supabaseClient"
import Header from "@/components/Header"

export default function ManagePartiesPage() {
  const [parties, setParties] = useState<any[]>([])
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  useEffect(() => {
    fetchParties()
  }, [])

  const fetchParties = async () => {
    const { data, error } = await supabase.from("parties").select("id, name")
    if (error) {
      setError(error.message)
    } else {
      setParties(data)
    }
  }

  const handleAdd = async () => {
    if (!name) {
      setError("Party name is required.")
      return
    }

    const { error: insertError } = await supabase.from("parties").insert({ name })

    if (insertError) {
      setError(insertError.message)
    } else {
      setName("")
      fetchParties()
    }
  }

  const startEdit = (party: any) => {
    setEditingId(party.id)
    setEditingName(party.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName("")
  }

  const saveEdit = async () => {
    if (!editingName) {
      setError("Party name cannot be empty.")
      return
    }

    const { error: updateError } = await supabase
      .from("parties")
      .update({ name: editingName })
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

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Party Name"
        className="border p-2 mb-2 w-full"
      />

      <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 w-full mb-4">
        Add Party
      </button>

      {error && <p className="text-red-600">{error}</p>}

      <h2 className="font-bold mb-2">Existing Parties:</h2>
      <ul>
        {parties.map((p) => (
          <li key={p.id} className="mb-2">
            {editingId === p.id ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="border p-1 flex-1"
                />
                <button onClick={saveEdit} className="bg-green-600 text-white px-2 py-1">Save</button>
                <button onClick={cancelEdit} className="bg-gray-400 text-white px-2 py-1">Cancel</button>
              </div>
            ) : (
              <div className="flex justify-between">
                <span>{p.name}</span>
                <button onClick={() => startEdit(p)} className="text-blue-600 underline">Edit</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}