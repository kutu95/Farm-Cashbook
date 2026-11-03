import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { User } from '@supabase/supabase-js'

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

type CashbookUser = {
  user_id: string
  role: string
  email: string
  full_name: string | null
  created_at: string | null
  last_sign_in_at: string | null
}

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: roleData, error: roleCheckError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (roleCheckError || roleData?.role !== 'admin') {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      ),
    }
  }

  return { session }
}

function belongsToCashbook(user: User) {
  const app = user.user_metadata?.app
  return !app || app === 'cashbook'
}

async function listCashbookUsers(): Promise<CashbookUser[]> {
  const { data: allRoleData, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select('user_id, role, created_at')

  if (roleError) throw roleError

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 200,
  })
  if (userError) throw userError

  const ids = (allRoleData || []).map((role) => role.user_id)
  const { data: profiles, error: profileError } = ids.length
    ? await supabaseAdmin.from('profiles').select('id, full_name').in('id', ids)
    : { data: [], error: null }
  if (profileError) throw profileError

  const profileName = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]))

  return (allRoleData || [])
    .map((role) => {
      const user = (userData.users as User[]).find((entry) => entry.id === role.user_id)
      if (!user || !belongsToCashbook(user)) return null
      return {
        user_id: role.user_id,
        role: role.role,
        email: user.email || '',
        full_name: profileName.get(role.user_id) || null,
        created_at: user.created_at || role.created_at || null,
        last_sign_in_at: user.last_sign_in_at || null,
      }
    })
    .filter((item): item is CashbookUser => item !== null)
    .sort((a, b) => a.email.localeCompare(b.email))
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    return NextResponse.json(await listCashbookUsers())
  } catch (error) {
    console.error('Error in users route:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { userId, role } = await request.json()
    if (!userId || (role !== 'admin' && role !== 'user')) {
      return NextResponse.json({ error: 'A user and a valid role are required' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingError) throw existingError
    if (!existing) {
      return NextResponse.json({ error: 'That person is not a Farm Cashbook user' }, { status: 404 })
    }

    if (existing.role === 'admin' && role !== 'admin') {
      const { count, error: countError } = await supabaseAdmin
        .from('user_roles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .neq('user_id', userId)

      if (countError) throw countError
      if (!count) {
        return NextResponse.json({ error: 'At least one admin is required' }, { status: 400 })
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('user_roles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating user role:', error)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'A user is required' }, { status: 400 })
    }

    if (userId === auth.session?.user.id) {
      return NextResponse.json({ error: 'You cannot remove your own access' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingError) throw existingError
    if (!existing) {
      return NextResponse.json({ error: 'That person is not a Farm Cashbook user' }, { status: 404 })
    }

    if (existing.role === 'admin') {
      const { count, error: countError } = await supabaseAdmin
        .from('user_roles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .neq('user_id', userId)

      if (countError) throw countError
      if (!count) {
        return NextResponse.json({ error: 'At least one admin is required' }, { status: 400 })
      }
    }

    const { error: subscriptionError } = await supabaseAdmin
      .from('email_subscriptions')
      .delete()
      .eq('user_id', userId)

    if (subscriptionError) throw subscriptionError

    const { error: deleteError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing user:', error)
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 })
  }
}
