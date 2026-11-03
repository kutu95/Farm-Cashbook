const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function formatMoney(amount: number) {
  return amount.toLocaleString("en-AU", { style: "currency", currency: "AUD" })
}

/** Format a YYYY-MM-DD value without shifting the day across time zones. */
export function formatDisplayDate(value: string) {
  if (!value) return ""
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return value
  return `${Number(match[3])} ${month} ${match[1]}`
}

export function todayISO() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}
