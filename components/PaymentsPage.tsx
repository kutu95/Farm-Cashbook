"use client"

import { useEffect, useState } from 'react'
import supabase from "@/lib/supabaseClient"

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    async function loadUserAndPayments() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        console.error('No session or error getting session:', sessionError?.message)
        setUserEmail('Unknown')
        return
      }

      setUserEmail(session.user.email)

      const { data, error: paymentsError } = await supabase
        .from('payments')
        .select('*')

      if (paymentsError) {
        console.error('Error loading payments:', paymentsError.message)
      } else {
        setPayments(data)
      }
    }

    loadUserAndPayments()
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">Payments</h1>
      <p className="mb-4 text-sm text-gray-600">Logged in as: {userEmail}</p>

      <ul className="space-y-2">
        {payments.map((payment, idx) => (
          <li key={idx} className="p-2 border rounded bg-white">
            {JSON.stringify(payment)}
          </li>
        ))}
      </ul>
    </div>
  )
}