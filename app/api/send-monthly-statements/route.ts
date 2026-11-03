import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { sendMonthlyStatements } from "@/lib/statements/monthlySend"

function secretMatches(request: NextRequest) {
  const expected = process.env.STATEMENT_CRON_SECRET || ""
  const header = request.headers.get("authorization") || ""
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : ""
  if (!expected || !provided) return false
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  if (expectedBuffer.length !== providedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, providedBuffer)
}

export async function POST(request: NextRequest) {
  if (!process.env.STATEMENT_CRON_SECRET) {
    console.error("Monthly statements were not sent because STATEMENT_CRON_SECRET is not set")
    return NextResponse.json({ error: "Statement sending is not configured" }, { status: 503 })
  }
  if (!secretMatches(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await sendMonthlyStatements()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Monthly statement send failed:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json({ error: "Could not send the statements" }, { status: 500 })
  }
}
