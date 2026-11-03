import { ReactNode } from "react"

export default function PageFrame({
  title,
  description,
  actions,
  children,
  width = "6xl",
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  width?: "3xl" | "6xl" | "full"
}) {
  const maxWidth = width === "3xl" ? "max-w-3xl" : width === "full" ? "max-w-none" : "max-w-6xl"

  return (
    <div className={`mx-auto w-full ${maxWidth}`}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm text-gray-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}
