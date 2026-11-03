import { ReactNode } from "react"

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center">
      <p className="font-medium text-gray-900">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
