import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { User } from '@supabase/supabase-js'

// Create a Supabase client with the service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET() {
  try {
    // Use regular client for role data
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check if user is authenticated and is admin
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: roleData, error: roleCheckError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single()

    if (roleCheckError || roleData?.role !== "admin") {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    // Get all user roles
    const { data: allRoleData, error: roleError } = await supabase
      .from("user_roles")
      .select("user_id, role")

    if (roleError) throw roleError

    // Get user data using admin client
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers()

    if (userError) throw userError

    // Combine the data
    const transformedData = allRoleData
      .map(role => {
        const user = (userData.users as User[]).find(u => u.id === role.user_id)
        if (!user) return null // Return null for roles without users
        return {
          user_id: role.user_id,
          role: role.role,
          email: user.email
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null) // Remove null entries

    return NextResponse.json(transformedData)
  } catch (error: any) {
    console.error('Error in users route:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
} 