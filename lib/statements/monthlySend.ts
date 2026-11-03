import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { formatDisplayDate, formatMoney } from "@/lib/format"
import { generateStatementPDF } from "@/app/utils/generateStatementPDF"
import {
  DEFAULT_STATEMENT_EMAIL_CONTENT,
  DEFAULT_STATEMENT_EMAIL_TITLE,
  STATEMENT_EMAIL_SLUG,
  previousMonthEnd,
  statementEmailHtml,
  statementEmailSubject,
} from "@/lib/statements/emailTemplate"

type PaymentRow = {
  party_id: string
  amount: number
  payment_date: string
  description: string | null
}

type AllocationRow = {
  party_id: string
  allocated_amount: number
  expense_id: string
}

type ExpenseRow = {
  id: string
  expense_date: string
  description: string | null
}

export type MonthlySendResult = {
  periodEnd: string
  sent: { email: string; parties: string[]; amountOwed: string }[]
  skipped: { email: string; reason: string }[]
  failed: { email: string; error: string }[]
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Statement email is not configured")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function templateText(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("pages")
    .select("title, content")
    .eq("slug", STATEMENT_EMAIL_SLUG)
    .maybeSingle()
  if (error) throw error
  return {
    title: data?.title || DEFAULT_STATEMENT_EMAIL_TITLE,
    content: data?.content || DEFAULT_STATEMENT_EMAIL_CONTENT,
  }
}

export async function sendMonthlyStatements(now = new Date()): Promise<MonthlySendResult> {
  const periodEnd = previousMonthEnd(now)
  const endDateLabel = formatDisplayDate(periodEnd)
  const supabase = serviceClient()
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) throw new Error("Email is not configured")

  const template = await templateText(supabase)
  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("email_subscriptions")
    .select("user_id, party_id")
  if (subscriptionError) throw subscriptionError

  const rows = subscriptions || []
  const result: MonthlySendResult = { periodEnd, sent: [], skipped: [], failed: [] }
  if (rows.length === 0) return result

  const userIds = [...new Set(rows.map((row) => row.user_id))]
  const partyIds = [...new Set(rows.map((row) => row.party_id))]

  const [{ data: parties, error: partyError }, { data: profiles, error: profileError }, { data: payments, error: paymentError }, { data: allocations, error: allocationError }, { data: alreadySent, error: sentError }, listed] = await Promise.all([
    supabase.from("parties").select("id, name").in("id", partyIds),
    supabase.from("profiles").select("id, full_name").in("id", userIds),
    supabase.from("payments").select("party_id, amount, payment_date, description").in("party_id", partyIds).lte("payment_date", periodEnd),
    supabase.from("expense_allocations").select("party_id, allocated_amount, expense_id").in("party_id", partyIds),
    supabase.from("statement_email_sends").select("user_id").eq("period_end", periodEnd).in("user_id", userIds),
    supabase.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ])
  if (partyError) throw partyError
  if (profileError) throw profileError
  if (paymentError) throw paymentError
  if (allocationError) throw allocationError
  if (sentError) throw sentError
  if (listed.error) throw listed.error

  const expenseIds = [...new Set((allocations || []).map((row) => row.expense_id))]
  const { data: expenses, error: expenseError } = expenseIds.length
    ? await supabase.from("expenses").select("id, expense_date, description").in("id", expenseIds).lte("expense_date", periodEnd)
    : { data: [], error: null }
  if (expenseError) throw expenseError

  const partyName = new Map((parties || []).map((party) => [party.id, party.name as string]))
  const profileName = new Map((profiles || []).map((profile) => [profile.id, profile.full_name as string | null]))
  const emailByUser = new Map(
    (listed.data?.users || []).map((user) => [user.id, user.email || ""])
  )
  const sentUsers = new Set((alreadySent || []).map((row) => row.user_id))
  const expenseById = new Map(((expenses || []) as ExpenseRow[]).map((expense) => [expense.id, expense]))
  const paymentsByParty = new Map<string, PaymentRow[]>()
  for (const payment of (payments || []) as PaymentRow[]) {
    const list = paymentsByParty.get(payment.party_id) || []
    list.push(payment)
    paymentsByParty.set(payment.party_id, list)
  }
  const allocationsByParty = new Map<string, AllocationRow[]>()
  for (const allocation of (allocations || []) as AllocationRow[]) {
    if (!expenseById.has(allocation.expense_id)) continue
    const list = allocationsByParty.get(allocation.party_id) || []
    list.push(allocation)
    allocationsByParty.set(allocation.party_id, list)
  }

  const partiesByUser = new Map<string, string[]>()
  for (const row of rows) {
    const list = partiesByUser.get(row.user_id) || []
    list.push(row.party_id)
    partiesByUser.set(row.user_id, list)
  }

  const resend = new Resend(resendKey)

  for (const userId of userIds) {
    const email = emailByUser.get(userId) || ""
    if (!email) {
      result.failed.push({ email: userId, error: "No email address" })
      continue
    }
    if (sentUsers.has(userId)) {
      result.skipped.push({ email, reason: "Already sent for this month" })
      continue
    }

    const userPartyIds = partiesByUser.get(userId) || []
    let amountOwed = 0
    const statements = userPartyIds.map((partyId) => {
      const name = partyName.get(partyId) || "Party"
      const partyPayments = paymentsByParty.get(partyId) || []
      const partyAllocations = allocationsByParty.get(partyId) || []
      const paymentTotal = partyPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
      const chargeTotal = partyAllocations.reduce((sum, allocation) => sum + Number(allocation.allocated_amount), 0)
      const balance = paymentTotal - chargeTotal
      if (balance < 0) amountOwed += -balance

      const transactions = [
        ...partyPayments.map((payment) => ({
          date: payment.payment_date,
          description: payment.description || "Payment",
          type: "Payment",
          amount: Number(payment.amount),
          sort: 0,
        })),
        ...partyAllocations.map((allocation) => {
          const expense = expenseById.get(allocation.expense_id)
          return {
            date: expense?.expense_date || periodEnd,
            description: expense?.description || "Expense",
            type: "Expense",
            amount: -Number(allocation.allocated_amount),
            sort: 1,
          }
        }),
      ].sort((a, b) => a.date.localeCompare(b.date) || a.sort - b.sort)

      return {
        partyName: name,
        closingBalance: balance,
        transactions: transactions.map(({ date, description, type, amount }) => ({ date, description, type, amount })),
      }
    })

    const owedLabel = formatMoney(amountOwed)
    const name = profileName.get(userId)?.trim() || email
    const values = { name, endDate: endDateLabel, amountOwed: owedLabel }

    try {
      const attachments = statements.map((statement) => {
        const pdf = generateStatementPDF(statement)
        const buffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf)
        const fileParty = statement.partyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        return {
          filename: `landlife-statement-${fileParty}-${periodEnd}.pdf`,
          content: buffer,
        }
      })

      const { error: emailError } = await resend.emails.send({
        from: "Landlife <statements@landlife.au>",
        to: [email],
        subject: statementEmailSubject(template.title, values),
        html: statementEmailHtml(template.content, values),
        attachments,
      })
      if (emailError) throw new Error(emailError.message)

      const { error: recordError } = await supabase.from("statement_email_sends").insert({
        user_id: userId,
        period_end: periodEnd,
      })
      if (recordError) throw recordError

      result.sent.push({
        email,
        parties: statements.map((statement) => statement.partyName),
        amountOwed: owedLabel,
      })
    } catch (error) {
      result.failed.push({
        email,
        error: error instanceof Error ? error.message : "Could not send the statement",
      })
    }
  }

  return result
}
