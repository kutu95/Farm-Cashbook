import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { parseElectricityBill } from '../lib/parseElectricityBill'
import { attachBillPdf, saveElectricityBillWithExpense } from '../lib/electricityBillExpense'

function loadEnv(file: string) {
  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[match[1]]) process.env[match[1]] = value
  }
}

function readBill(file: string): Buffer {
  let lastError: unknown
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      return fs.readFileSync(file)
    } catch (error) {
      lastError = error
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ETIMEDOUT' && code !== 'EAGAIN' && code !== 'EBUSY') throw error
      execFileSync('sleep', ['3'])
    }
  }
  throw lastError
}

function walkBills(dir: string): string[] {
  const output = execFileSync('find', [dir, '-type', 'f', '-iname', 'SynergyBill_*.pdf'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 180000,
  })
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort()
}

async function main() {
  const root = process.argv[2]
  const year = process.argv[3]
  if (!root) {
    throw new Error('Pass the folder of Synergy bills')
  }
  if (year && !/^\d{4}$/.test(year)) {
    throw new Error('Year filter must be four digits, for example 2026')
  }

  loadEnv(path.join(process.cwd(), '.env.local'))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Supabase URL and service role key are required')
  }

  const files = walkBills(root).filter((file) => {
    if (!year) return true
    return path.basename(file).startsWith(`SynergyBill_${year}`)
  })
  console.log(`Found ${files.length} SynergyBill PDFs${year ? ` for ${year}` : ''}`)

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: listed, error: userError } = await supabase.auth.admin.listUsers({ perPage: 200 })
  if (userError) throw userError
  const user = listed.users.find((candidate) => candidate.email === 'john@streamtime.com.au')
  if (!user) throw new Error('Could not find john@streamtime.com.au')

  const summary = {
    created: 0,
    linked: 0,
    already_recorded: 0,
    attached: 0,
    already_attached: 0,
    failed: 0,
  }

  for (const file of files) {
    const name = path.basename(file)
    try {
      const bytes = readBill(file)
      const parsed = await parseElectricityBill(bytes)
      if (year && !parsed.billDate.startsWith(`${year}-`)) {
        console.log(`${name}: skipped, bill date ${parsed.billDate} is not in ${year}`)
        continue
      }
      const result = await saveElectricityBillWithExpense(supabase, user.id, {
        billDate: parsed.billDate,
        billDateRangeStart: parsed.billDateRangeStart,
        billDateRangeEnd: parsed.billDateRangeEnd,
        totalUnitsConsumed: parsed.totalUnitsConsumed,
        unitsPerDay: parsed.unitsPerDay,
        isEstimated: parsed.isEstimated,
        accountNumber: parsed.accountNumber,
        billAmount: parsed.billAmount,
        meterReading: parsed.meterReading,
      })

      summary[result.expenseStatus] += 1
      if (!result.bill.expense_id) {
        throw new Error('Bill was saved without an expense')
      }

      const attachment = await attachBillPdf(supabase, {
        billId: result.bill.id,
        expenseId: result.bill.expense_id,
        fileName: name,
        bytes,
        createdBy: user.id,
      })
      summary[attachment === 'attached' ? 'attached' : 'already_attached'] += 1

      console.log(
        `${name}: expense ${result.expenseStatus}, pdf ${attachment}, ${parsed.accountNumber}, ${parsed.billDate}, $${parsed.billAmount}`
      )
    } catch (error) {
      summary.failed += 1
      console.error(`${name}: FAILED ${error instanceof Error ? error.message : error}`)
    }
  }

  console.log('Summary', summary)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
