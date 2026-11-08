export const STATEMENT_EMAIL_SLUG = "statement-email"

export const LANDLIFE_FROM = "Landlife <john@margies.app>"
export const CASHBOOK_FROM = "Farm Cashbook <john@margies.app>"

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;"
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case "\"":
        return "&quot;"
      default:
        return "&#39;"
    }
  })
}

export const STATEMENT_EMAIL_PLACEHOLDERS = [
  { token: "{{name}}", label: "Name", detail: "The person’s name. Their email is used when no name is saved." },
  { token: "{{end_date}}", label: "End date", detail: "The last day included in the statement, such as 31 Oct 2026." },
  { token: "{{amount_owed}}", label: "Amount owed", detail: "The total they owe the farm across the attached statements. A party in credit does not reduce this total." },
] as const

export const DEFAULT_STATEMENT_EMAIL_TITLE = "Farm statement to {{end_date}}"

export const DEFAULT_STATEMENT_EMAIL_CONTENT = `Hello {{name}},

Your statement up to {{end_date}} is attached.

The total you owe the farm is {{amount_owed}}.

Synergy bills are in this folder: https://drive.google.com/drive/folders/1A-3aG0eZVZKzuu_4OEbYglnxe78qrTZJ

Best regards,
Landlife`

function sydneyDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  }
}

export function previousMonthEnd(now = new Date()) {
  const { year, month } = sydneyDateParts(now)
  const end = new Date(Date.UTC(year, month - 1, 0))
  const endMonth = String(end.getUTCMonth() + 1).padStart(2, "0")
  const endDay = String(end.getUTCDate()).padStart(2, "0")
  return `${end.getUTCFullYear()}-${endMonth}-${endDay}`
}

export function sydneyToday(now = new Date()) {
  const { year, month, day } = sydneyDateParts(now)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function fillStatementTemplate(template: string, values: {
  name: string
  endDate: string
  amountOwed: string
}) {
  return template
    .replaceAll("{{name}}", values.name)
    .replaceAll("{{end_date}}", values.endDate)
    .replaceAll("{{amount_owed}}", values.amountOwed)
}

export function statementEmailHtml(template: string, values: {
  name: string
  endDate: string
  amountOwed: string
}) {
  return template
    .split(/(\{\{(?:name|end_date|amount_owed)\}\})/g)
    .map((part) => {
      if (part === "{{name}}") return escapeHtml(values.name)
      if (part === "{{end_date}}") return escapeHtml(values.endDate)
      if (part === "{{amount_owed}}") return escapeHtml(values.amountOwed)
      return escapeHtml(part)
    })
    .join("")
    .replaceAll("\n", "<br>")
}

export function statementEmailSubject(title: string, values: {
  name: string
  endDate: string
  amountOwed: string
}) {
  return fillStatementTemplate(title, values).replace(/\s+/g, " ").trim()
}
