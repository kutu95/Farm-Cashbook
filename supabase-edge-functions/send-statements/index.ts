import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Get the user from the auth header
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid user')
    }

    // Get user's email
    const { data: userData, error: emailError } = await supabaseClient
      .from('auth.users')
      .select('email')
      .eq('id', user.id)
      .single()

    if (emailError || !userData?.email) {
      throw new Error('Could not get user email')
    }

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(1) // First day of current month
    const endDate = new Date() // Current date

    // Get subscribed parties and generate statements
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('email_subscriptions')
      .select('party_id')
      .eq('user_id', user.id)

    if (subError) {
      throw new Error('Could not get subscriptions')
    }

    if (!subscriptions || subscriptions.length === 0) {
      throw new Error('No subscribed statements found')
    }

    // Generate statements for each party
    const statements = await Promise.all(
      subscriptions.map(async (sub) => {
        const { data: statement, error: stmtError } = await supabaseClient
          .rpc('generate_party_statement', {
            p_party_id: sub.party_id,
            p_start_date: startDate.toISOString(),
            p_end_date: endDate.toISOString()
          })

        if (stmtError) {
          throw new Error(`Error generating statement: ${stmtError.message}`)
        }

        return statement
      })
    )

    // Send email using Resend or your preferred email service
    // For now, we'll just return success
    return new Response(
      JSON.stringify({ 
        message: 'Statements generated successfully',
        count: statements.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 