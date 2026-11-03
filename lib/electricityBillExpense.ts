import type { SupabaseClient } from '@supabase/supabase-js'

export type ExpenseLinkStatus = 'created' | 'linked' | 'already_recorded'

export class ElectricityBillSaveError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ElectricityBillSaveError'
    this.status = status
  }
}

export interface SaveElectricityBillInput {
  billDate: string
  billDateRangeStart: string
  billDateRangeEnd: string
  totalUnitsConsumed: number
  unitsPerDay?: number | null
  isEstimated?: boolean
  accountNumber: string
  billAmount: number
  meterReading?: number | null
}

interface BillRow {
  id: string
  bill_date: string
  account_number: string
  bill_amount: number
  expense_id?: string | null
}

interface PartyRow {
  id: string
  name: string
}

function fail(error: { message?: string } | null | undefined, fallback: string, status = 500): never {
  console.error(fallback, error)
  throw new ElectricityBillSaveError(error?.message || fallback, status)
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

/** Split a dollar amount into equal cent shares. Extra cents go to the earliest parties. */
export function splitAmountEvenly(total: number, count: number): number[] {
  if (count <= 0) return []
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / count)
  let remainder = cents - base * count
  return Array.from({ length: count }, () => {
    const share = base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder -= 1
    return share / 100
  })
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&')
}

async function findBill(
  supabase: SupabaseClient,
  input: SaveElectricityBillInput
): Promise<BillRow | null> {
  const { data, error } = await supabase
    .from('electricity_bills')
    .select('id, bill_date, account_number, bill_amount, expense_id')
    .eq('bill_date_range_start', input.billDateRangeStart)
    .eq('bill_date_range_end', input.billDateRangeEnd)
    .eq('account_number', input.accountNumber)
    .maybeSingle()

  if (error) fail(error, 'Failed to look up electricity bill')
  return data
}

async function insertBill(
  supabase: SupabaseClient,
  input: SaveElectricityBillInput
): Promise<BillRow> {
  const { data, error } = await supabase
    .from('electricity_bills')
    .insert({
      bill_date: input.billDate,
      bill_date_range_start: input.billDateRangeStart,
      bill_date_range_end: input.billDateRangeEnd,
      total_units_consumed: input.totalUnitsConsumed,
      units_per_day: input.unitsPerDay ?? null,
      is_estimated: input.isEstimated ?? false,
      account_number: input.accountNumber,
      bill_amount: input.billAmount,
      meter_reading: input.meterReading ?? null,
    })
    .select('id, bill_date, account_number, bill_amount, expense_id')
    .single()

  if (error) {
    if (error.code === '23505') {
      const existing = await findBill(supabase, input)
      if (existing) return existing
    }
    fail(error, 'Failed to create bill')
  }

  return data
}

async function linkExpense(
  supabase: SupabaseClient,
  billId: string,
  expenseId: string
): Promise<BillRow | 'conflict'> {
  const { data, error } = await supabase
    .from('electricity_bills')
    .update({ expense_id: expenseId })
    .eq('id', billId)
    .is('expense_id', null)
    .select('id, bill_date, account_number, bill_amount, expense_id')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') return 'conflict'
    fail(error, 'Failed to link expense')
  }

  if (!data) return 'conflict'
  return data
}

async function findUnlinkedExpense(
  supabase: SupabaseClient,
  bill: BillRow
): Promise<string | null> {
  const amount = roundMoney(Number(bill.bill_amount))

  const { data: linkedRows, error: linkedError } = await supabase
    .from('electricity_bills')
    .select('expense_id')
    .not('expense_id', 'is', null)

  if (linkedError) fail(linkedError, 'Failed to look up linked expenses')

  const linkedIds = new Set(
    (linkedRows || [])
      .map((row) => row.expense_id)
      .filter((id): id is string => Boolean(id))
  )

  const { data: candidates, error } = await supabase
    .from('expenses')
    .select('id')
    .eq('expense_date', bill.bill_date)
    .eq('amount', amount)
    .ilike('description', `%${escapeIlike(bill.account_number)}%`)

  if (error) fail(error, 'Failed to look up existing expenses')

  const match = (candidates || []).find((candidate) => !linkedIds.has(candidate.id))
  return match?.id ?? null
}

async function resolveParties(
  supabase: SupabaseClient,
  accountNumber: string
): Promise<{ parties: PartyRow[]; equalSplit: boolean }> {
  const { data: matching, error: matchingError } = await supabase
    .from('parties')
    .select('id, name')
    .eq('electricity_account_number', accountNumber)
    .order('name')

  if (matchingError) fail(matchingError, 'Failed to look up parties')
  if (matching && matching.length > 0) {
    return { parties: matching, equalSplit: false }
  }

  const { data: allParties, error: allError } = await supabase
    .from('parties')
    .select('id, name')
    .order('name')

  if (allError) fail(allError, 'Failed to look up parties')
  if (!allParties || allParties.length === 0) {
    throw new ElectricityBillSaveError('No parties found to allocate this bill', 400)
  }

  return { parties: allParties, equalSplit: true }
}

async function createExpense(
  supabase: SupabaseClient,
  userId: string,
  bill: BillRow
): Promise<{ bill: BillRow; expenseStatus: 'created' | 'already_recorded' }> {
  const amount = roundMoney(Number(bill.bill_amount))
  const { parties, equalSplit } = await resolveParties(supabase, bill.account_number)
  const description = equalSplit
    ? `Synergy bill for ${bill.account_number} (equal split)`
    : `Synergy bill for ${bill.account_number}`

  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      description,
      amount,
      expense_date: bill.bill_date,
      user_id: userId,
    })
    .select('id')
    .single()

  if (expenseError || !expense) fail(expenseError, 'Failed to record expense')

  const shares = splitAmountEvenly(amount, parties.length)
  const allocationInserts = parties
    .map((party, index) => ({
      expense_id: expense.id,
      party_id: party.id,
      allocated_amount: shares[index],
    }))
    .filter((allocation) => allocation.allocated_amount > 0)

  if (allocationInserts.length > 0) {
    const { error: allocationError } = await supabase
      .from('expense_allocations')
      .insert(allocationInserts)

    if (allocationError) {
      await supabase.from('expenses').delete().eq('id', expense.id)
      fail(allocationError, 'Failed to allocate expense')
    }
  }

  const linked = await linkExpense(supabase, bill.id, expense.id)
  if (linked === 'conflict') {
    await supabase.from('expenses').delete().eq('id', expense.id)
    const current = await reloadBill(supabase, bill.id)
    if (current.expense_id) {
      return { bill: current, expenseStatus: 'already_recorded' }
    }
    fail(null, 'Failed to link expense')
  }

  return { bill: linked, expenseStatus: 'created' }
}

async function reloadBill(supabase: SupabaseClient, billId: string): Promise<BillRow> {
  const { data, error } = await supabase
    .from('electricity_bills')
    .select('id, bill_date, account_number, bill_amount, expense_id')
    .eq('id', billId)
    .single()

  if (error || !data) fail(error, 'Failed to look up electricity bill')
  return data
}

async function attachExpense(
  supabase: SupabaseClient,
  userId: string,
  bill: BillRow
): Promise<{ bill: BillRow; expenseStatus: ExpenseLinkStatus }> {
  const current = await reloadBill(supabase, bill.id)
  if (current.expense_id) {
    return { bill: current, expenseStatus: 'already_recorded' }
  }

  const existingExpenseId = await findUnlinkedExpense(supabase, current)
  if (existingExpenseId) {
    const linked = await linkExpense(supabase, current.id, existingExpenseId)
    if (linked !== 'conflict') {
      return { bill: linked, expenseStatus: 'linked' }
    }
  }

  return createExpense(supabase, userId, current)
}

export async function saveElectricityBillWithExpense(
  supabase: SupabaseClient,
  userId: string,
  input: SaveElectricityBillInput
): Promise<{ bill: BillRow; expenseStatus: ExpenseLinkStatus }> {
  const existing = await findBill(supabase, input)
  const bill = existing ?? await insertBill(supabase, input)
  return attachExpense(supabase, userId, bill)
}

export async function attachBillPdf(
  supabase: SupabaseClient,
  input: {
    billId: string
    expenseId: string
    fileName: string
    bytes: Buffer
    createdBy?: string | null
  }
): Promise<'attached' | 'already_attached'> {
  const { data: bill, error } = await supabase
    .from('electricity_bills')
    .select('pdf_file_path')
    .eq('id', input.billId)
    .single()

  if (error) fail(error, 'Failed to look up bill file')
  if (bill?.pdf_file_path) return 'already_attached'

  const safeName = input.fileName.replace(/[^A-Za-z0-9._-]/g, '_')
  const filePath = `expenses/${input.expenseId}/${Date.now()}_${safeName}`
  const { error: uploadError } = await supabase.storage
    .from('document-attachments')
    .upload(filePath, new Uint8Array(input.bytes), {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) fail(uploadError, 'Failed to upload bill PDF')

  const { error: updateError } = await supabase
    .from('electricity_bills')
    .update({ pdf_file_path: filePath })
    .eq('id', input.billId)
    .is('pdf_file_path', null)

  if (updateError) {
    await supabase.storage.from('document-attachments').remove([filePath])
    fail(updateError, 'Failed to store bill file path')
  }

  return 'attached'
}

export function expenseStatusMessage(status: ExpenseLinkStatus): string {
  switch (status) {
    case 'created':
      return 'Electricity bill saved and the expense was recorded'
    case 'linked':
      return 'Electricity bill saved and linked to an existing expense'
    case 'already_recorded':
      return 'This bill is already in the cashbook'
  }
}
