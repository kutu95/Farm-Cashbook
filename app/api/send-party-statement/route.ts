import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { sendCurrentPartyStatement, StatementSendError } from "@/lib/statements/sendPartyStatement"

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: roleData, error: roleCheckError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (roleCheckError || roleData?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 403 })
  }

  return null
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const body = await request.json().catch(() => null)
    const partyId = typeof body?.partyId === "string" ? body.partyId : ""
    const result = await sendCurrentPartyStatement(partyId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof StatementSendError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Party statement send failed:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json({ error: "Could not send the statement" }, { status: 500 })
  }
}
