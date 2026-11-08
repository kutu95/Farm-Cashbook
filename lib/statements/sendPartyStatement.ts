import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { formatDisplayDate, formatMoney } from "@/lib/format"
import { generateStatementPDF } from "@/app/utils/generateStatementPDF"
import {
  DEFAULT_STATEMENT_EMAIL_CONTENT,
  DEFAULT_STATEMENT_EMAIL_TITLE,
  STATEMENT_EMAIL_SLUG,
  statementEmailHtml,
  statementEmailSubject,
  sydneyToday,
} from "@/lib/statements/emailTemplate"

const PARTY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class StatementSendError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type PartyStatementSendResult = {
  partyName: string
  periodEnd: string
  sent: { email: string; amountOwed: string }[]
  failed: { email: string; error: string }[]
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new StatementSendError("Statement email is not configured", 503)
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function sendCurrentPartyStatement(partyId: string, now = new Date()): Promise<PartyStatementSendResult> {
  if (!PARTY_ID.test(partyId)) throw new StatementSendError("Choose a party", 400)

  const periodEnd = sydneyToday(now)
  const supabase = serviceClient()
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) throw new StatementSendError("Email is not configured", 503)

  const { data: party, error: partyError } = await supabase
    .from("parties")
    .select("id, name")
    .eq("id", partyId)
    .maybeSingle()
  if (partyError) throw partyError
  if (!party) throw new StatementSendError("Party not found", 404)

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("email_subscriptions")
    .select("user_id")
    .eq("party_id", partyId)
  if (subscriptionError) throw subscriptionError

  const userIds = [...new Set((subscriptions || []).map((row) => row.user_id))]
  if (userIds.length === 0) {
    throw new StatementSendError("Nobody is set to receive statements for this party. Choose them on the Users page.", 400)
  }

  const [{ data: templateRow, error: templateError }, { data: profiles, error: profileError }, { data: payments, error: paymentError }, { data: allocations, error: allocationError }] = await Promise.all([
    supabase.from("pages").select("title, content").eq("slug", STATEMENT_EMAIL_SLUG).maybeSingle(),
    supabase.from("profiles").select("id, full_name").in("id", userIds),
    supabase.from("payments").select("amount, payment_date, description").eq("party_id", partyId).lte("payment_date", periodEnd),
    supabase.from("expense_allocations").select("allocated_amount, expense_id").eq("party_id", partyId),
  ])
  if (templateError) throw templateError
  if (profileError) throw profileError
  if (paymentError) throw paymentError
  if (allocationError) throw allocationError

  const expenseIds = [...new Set((allocations || []).map((row) => row.expense_id))]
  const { data: expenses, error: expenseError } = expenseIds.length
    ? await supabase.from("expenses").select("id, expense_date, description").in("id", expenseIds).lte("expense_date", periodEnd)
    : { data: [], error: null }
  if (expenseError) throw expenseError

  const expenseById = new Map((expenses || []).map((expense) => [expense.id, expense]))
  const includedAllocations = (allocations || []).filter((allocation) => expenseById.has(allocation.expense_id))
  const paymentTotal = (payments || []).reduce((sum, payment) => sum + Number(payment.amount), 0)
  const chargeTotal = includedAllocations.reduce((sum, allocation) => sum + Number(allocation.allocated_amount), 0)
  const balance = paymentTotal - chargeTotal
  const amountOwed = balance < 0 ? -balance : 0
  const owedLabel = formatMoney(amountOwed)

  const transactions = [
    ...(payments || []).map((payment) => ({
      date: payment.payment_date as string,
      description: payment.description || "Payment",
      type: "Payment",
      amount: Number(payment.amount),
      sort: 0,
    })),
    ...includedAllocations.map((allocation) => {
      const expense = expenseById.get(allocation.expense_id)
      return {
        date: (expense?.expense_date as string) || periodEnd,
        description: expense?.description || "Expense",
        type: "Expense",
        amount: -Number(allocation.allocated_amount),
        sort: 1,
      }
    }),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.sort - b.sort)

  const pdf = generateStatementPDF({
    partyName: party.name,
    closingBalance: balance,
    transactions: transactions.map(({ date, description, type, amount }) => ({ date, description, type, amount })),
  })
  const buffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf)
  const fileParty = party.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const attachment = {
    filename: `landlife-statement-${fileParty}-${periodEnd}.pdf`,
    content: buffer,
  }

  const template = {
    title: templateRow?.title || DEFAULT_STATEMENT_EMAIL_TITLE,
    content: templateRow?.content || DEFAULT_STATEMENT_EMAIL_CONTENT,
  }
  const profileName = new Map((profiles || []).map((profile) => [profile.id, profile.full_name as string | null]))
  const resend = new Resend(resendKey)
  const result: PartyStatementSendResult = {
    partyName: party.name,
    periodEnd,
    sent: [],
    failed: [],
  }

  for (const userId of userIds) {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
    const email = userError ? "" : userData.user?.email || ""
    if (!email) {
      result.failed.push({ email: userId, error: "No email address" })
      continue
    }

    const name = profileName.get(userId)?.trim() || email
    const values = { name, endDate: formatDisplayDate(periodEnd), amountOwed: owedLabel }
    try {
      const { error: emailError } = await resend.emails.send({
        from: "Landlife <statements@landlife.au>",
        to: [email],
        subject: statementEmailSubject(template.title, values),
        html: statementEmailHtml(template.content, values),
        attachments: [attachment],
      })
      if (emailError) throw new Error(emailError.message)
      result.sent.push({ email, amountOwed: owedLabel })
    } catch (error) {
      result.failed.push({
        email,
        error: error instanceof Error ? error.message : "Could not send the statement",
      })
    }
  }

  return result
}
