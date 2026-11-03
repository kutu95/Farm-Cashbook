import { randomBytes } from 'crypto'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { User } from '@supabase/supabase-js'
import { isPlausibleEmail, sendPasswordEmail } from '@/lib/auth/password-reset'

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
  parties: string[]
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
  const { data: subscriptions, error: subscriptionError } = ids.length
    ? await supabaseAdmin.from('email_subscriptions').select('user_id, party_id').in('user_id', ids)
    : { data: [], error: null }
  if (subscriptionError) throw subscriptionError

  const subscribedPartyIds = [...new Set((subscriptions || []).map((row) => row.party_id))]
  const { data: subscribedParties, error: partyNameError } = subscribedPartyIds.length
    ? await supabaseAdmin.from('parties').select('id, name').in('id', subscribedPartyIds)
    : { data: [], error: null }
  if (partyNameError) throw partyNameError
  const partyName = new Map((subscribedParties || []).map((party) => [party.id, party.name as string]))

  const partyNames = new Map<string, string[]>()
  for (const row of subscriptions || []) {
    const name = partyName.get(row.party_id)
    if (!name) continue
    const current = partyNames.get(row.user_id) || []
    current.push(name)
    partyNames.set(row.user_id, current)
  }

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
        parties: (partyNames.get(role.user_id) || []).sort((a, b) => a.localeCompare(b)),
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

async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const users = (data?.users ?? []) as User[]
    const found = users.find((user) => user.email?.toLowerCase() === email)
    if (found) return found
    if (data.users.length < 200) return null
  }
  return null
}

async function cashbookUser(userId: string) {
  const users = await listCashbookUsers()
  return users.find((user) => user.user_id === userId) || null
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const body = await request.json()

    if (body.sendInstructions === true && typeof body.userId === 'string') {
      const existing = await cashbookUser(body.userId)
      if (!existing?.email) {
        return NextResponse.json({ error: 'That person is not a Farm Cashbook user' }, { status: 404 })
      }
      const sent = await sendPasswordEmail(request, existing.email, 'welcome')
      if (sent.status === 'failed') {
        return NextResponse.json({ error: sent.error }, { status: sent.httpStatus })
      }
      if (sent.status === 'missing') {
        return NextResponse.json({ error: 'No account exists for that email.' }, { status: 404 })
      }
      return NextResponse.json({ success: true, emailSent: true })
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const role = body.role === 'admin' ? 'admin' : body.role === 'user' ? 'user' : ''
    const partyIds = Array.isArray(body.partyIds)
      ? [...new Set(body.partyIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))]
      : []

    if (!isPlausibleEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }
    if (!role) {
      return NextResponse.json({ error: 'Choose a role.' }, { status: 400 })
    }

    if (partyIds.length > 0) {
      const { data: parties, error: partyError } = await supabaseAdmin
        .from('parties')
        .select('id')
        .in('id', partyIds)
      if (partyError) throw partyError
      if ((parties || []).length !== partyIds.length) {
        return NextResponse.json({ error: 'One of the selected parties no longer exists.' }, { status: 400 })
      }
    }

    const existingAuthUser = await findAuthUserByEmail(email)
    let userId = existingAuthUser?.id
    let createdAuthUser = false

    if (existingAuthUser) {
      if (!belongsToCashbook(existingAuthUser)) {
        return NextResponse.json(
          { error: 'That email belongs to another application and cannot be added here.' },
          { status: 409 }
        )
      }
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('user_id', existingAuthUser.id)
        .maybeSingle()
      if (membershipError) throw membershipError
      if (membership) {
        return NextResponse.json(
          { error: 'That person already has a Farm Cashbook account. Send them a login link from the list.' },
          { status: 409 }
        )
      }
    } else {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomBytes(32).toString('base64url'),
        email_confirm: true,
        user_metadata: { app: 'cashbook', full_name: fullName },
      })
      if (createError || !created.user) {
        const message = createError?.message?.toLowerCase() || ''
        if (message.includes('already') || message.includes('registered') || createError?.code === 'email_exists') {
          return NextResponse.json(
            { error: 'That email is already registered. Send them a login link from the list if they are a Farm Cashbook user.' },
            { status: 409 }
          )
        }
        console.error('Could not create auth user:', createError?.message)
        return NextResponse.json({ error: 'Could not create the user.' }, { status: 500 })
      }
      userId = created.user.id
      createdAuthUser = true
    }

    if (!userId) {
      return NextResponse.json({ error: 'Could not create the user.' }, { status: 500 })
    }

    const now = new Date().toISOString()
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email,
      full_name: fullName,
      updated_at: now,
    })
    if (profileError) {
      if (createdAuthUser) await supabaseAdmin.auth.admin.deleteUser(userId)
      throw profileError
    }

    const { error: roleError } = await supabaseAdmin.from('user_roles').upsert({
      user_id: userId,
      role,
      updated_at: now,
    }, { onConflict: 'user_id' })
    if (roleError) {
      if (createdAuthUser) await supabaseAdmin.auth.admin.deleteUser(userId)
      throw roleError
    }

    if (partyIds.length > 0) {
      const { error: subscriptionError } = await supabaseAdmin.from('email_subscriptions').upsert(
        partyIds.map((partyId) => ({ user_id: userId, party_id: partyId })),
        { onConflict: 'user_id,party_id' }
      )
      if (subscriptionError) throw subscriptionError
    }

    let emailSent = false
    let emailError: string | null = null
    if (body.sendInstructions === true) {
      const sent = await sendPasswordEmail(request, email, 'welcome')
      emailSent = sent.status === 'sent'
      if (sent.status !== 'sent') emailError = sent.status === 'failed' ? sent.error : 'No account exists for that email.'
    }

    return NextResponse.json({
      success: true,
      user: await cashbookUser(userId),
      emailSent,
      emailError,
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Could not create the user.' }, { status: 500 })
  }
}
