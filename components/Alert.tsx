import { ReactNode } from "react"

export default function Alert({
  tone,
  children,
}: {
  tone: "error" | "success"
  children: ReactNode
}) {
  const styles = tone === "error"
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-green-200 bg-green-50 text-green-800"

  return (
    <div role={tone === "error" ? "alert" : "status"} className={`mb-4 rounded-md border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  )
}
