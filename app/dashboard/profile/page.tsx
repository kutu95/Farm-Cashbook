"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import Header from "@/components/Header"
import { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const router = useRouter()
  const { supabase, session, loading: authLoading } = useAuth()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [sendingStatements, setSendingStatements] = useState(false)
  const [fullName, setFullName] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [subscribedParties, setSubscribedParties] = useState<string[]>([])

  useEffect(() => {
    if (authLoading) return

    if (!session) {
      router.push("/")
      return
    }

    setUser(session.user)
    loadData(session.user.id)
  }, [session, authLoading, router])

  const loadData = async (userId: string) => {
    try {
      setLoading(true)
      setError("")
      
      // Load profile data
      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle()

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError
      }

      if (!profileData) {
        // Profile doesn't exist, try to create it
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            full_name: "",
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (createError) {
          if (createError.code === '23505') { // Duplicate key error
            // Profile was created by another process, try to fetch it again
            const { data: retryData, error: retryError } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", userId)
              .single()

            if (retryError) throw retryError
            profileData = retryData
          } else {
            throw createError
          }
        } else {
          profileData = newProfile
        }
      }
      
      setFullName(profileData?.full_name || "")

      // Load user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)

      if (rolesError) throw rolesError
      setUserRoles(rolesData?.map(r => r.role) || [])

      // Load parties
      const { data: partiesData, error: partiesError } = await supabase
        .from("parties")
        .select("*")
        .order("name")

      if (partiesError) throw partiesError
      setParties(partiesData || [])

      // Load subscribed parties
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from("email_subscriptions")
        .select("party_id")
        .eq("user_id", userId)

      if (subscriptionsError) throw subscriptionsError
      setSubscribedParties(subscriptionsData?.map(s => s.party_id) || [])

    } catch (error: any) {
      console.error("Error loading profile data:", error.message)
      setError("Failed to load profile data: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) {
      setError("No user session found")
      return
    }

    setUpdating(true)
    setError("")
    setMessage("")

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      setMessage("Profile updated successfully!")
      
      // Reload user data
      await loadData(user.id)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setUpdating(false)
    }
  }

  const toggleSubscription = async (partyId: string) => {
    if (!user?.id) return

    setUpdating(true)
    setError("")
    setMessage("")

    try {
      if (subscribedParties.includes(partyId)) {
        // Unsubscribe
        const { error } = await supabase
          .from("email_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("party_id", partyId)

        if (error) throw error
        setSubscribedParties(prev => prev.filter(id => id !== partyId))
        setMessage("Unsubscribed successfully!")
      } else {
        // Subscribe
        const { error } = await supabase
          .from("email_subscriptions")
          .insert({
            user_id: user.id,
            party_id: partyId
          })

        if (error) throw error
        setSubscribedParties(prev => [...prev, partyId])
        setMessage("Subscribed successfully!")
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setUpdating(false)
    }
  }

  const sendStatementsOnDemand = async () => {
    if (!user?.id) return

    setSendingStatements(true)
    setError("")
    setMessage("")

    try {
      // Get statements from the database
      const { data, error } = await supabase
        .rpc('send_statements_on_demand', {
          p_user_id: user.id
        })

      if (error) throw error

      // Create a PDF for each statement
      const statements = data.statements
      const count = data.count

      // For now, just show success message
      // TODO: Add PDF generation and email sending
      setMessage(`Generated ${count} statement(s) successfully!`)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setSendingStatements(false)
    }
  }

  // Show loading state
  if (authLoading || loading) {
    return (
      <div className="p-6">
        <Header />
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="text-gray-600">Loading profile...</div>
        </div>
      </div>
    )
  }

  // Show nothing while redirecting
  if (!user) {
    return null
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Header />
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{message}</div>}

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Account Information</h2>
          <p className="text-gray-600">Email: {user?.email}</p>
          <p className="text-gray-600">Roles: {userRoles.length > 0 ? userRoles.join(", ") : "No roles assigned"}</p>
          <p className="text-gray-600">Last Sign In: {new Date(user?.last_sign_in_at || "").toLocaleString()}</p>
        </div>

        <form onSubmit={updateProfile}>
          <div className="mb-4">
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your full name"
            />
          </div>

          <button
            type="submit"
            disabled={updating}
            className={`w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              updating ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {updating ? "Updating..." : "Update Profile"}
          </button>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Monthly Statement Subscriptions</h2>
          <button
            onClick={sendStatementsOnDemand}
            disabled={sendingStatements || subscribedParties.length === 0}
            className={`bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
              (sendingStatements || subscribedParties.length === 0) ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {sendingStatements ? "Sending..." : "Send Statements Now"}
          </button>
        </div>
        <p className="text-gray-600 mb-4">
          Select the parties you want to receive monthly statements for. You'll receive a single email at the end of each month containing statements for all selected parties.
        </p>
        
        <div className="space-y-3">
          {parties.map(party => (
            <div key={party.id} className="flex items-center">
              <input
                type="checkbox"
                id={`party-${party.id}`}
                checked={subscribedParties.includes(party.id)}
                onChange={() => toggleSubscription(party.id)}
                disabled={updating}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`party-${party.id}`} className="ml-2 block text-sm text-gray-900">
                {party.name}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 