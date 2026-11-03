import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export const fieldControlClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

export function FormField({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-sm text-gray-500">{hint}</p> : null}
    </div>
  )
}

export function AllocationFields({
  rows,
  mode,
  target,
  onChange,
}: {
  rows: { partyId: string; name: string; value: string }[]
  mode: "fixed" | "percentage"
  target: number
  onChange: (partyId: string, value: string) => void
}) {
  const total = rows.reduce((sum, row) => sum + (Number.parseFloat(row.value || "0") || 0), 0)
  const remaining = target - total
  const balanced = target > 0 && Math.abs(remaining) < 0.001
  const formatValue = (value: number) =>
    mode === "percentage" ? `${value.toLocaleString("en-AU", { maximumFractionDigits: 2 })}%` : value.toLocaleString("en-AU", { style: "currency", currency: "AUD" })

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-medium text-gray-900">
          Allocated {formatValue(total)} of {formatValue(target || 0)}
        </p>
        <p className={balanced ? "text-green-800" : "text-amber-800"}>
          {target <= 0
            ? "Enter an amount first"
            : balanced
              ? "Split matches"
              : remaining > 0
                ? `${formatValue(remaining)} still to allocate`
                : `${formatValue(Math.abs(remaining))} over the total`}
        </p>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.partyId} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <label htmlFor={`alloc-${row.partyId}`} className="text-sm text-gray-800">
              {row.name}
            </label>
            <input
              id={`alloc-${row.partyId}`}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={row.value}
              onChange={(event) => onChange(row.partyId, event.target.value)}
              className={cn(fieldControlClass, "bg-white tabular-nums")}
            />
            <span className="text-sm text-gray-500">{mode === "percentage" ? "%" : "AUD"}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
