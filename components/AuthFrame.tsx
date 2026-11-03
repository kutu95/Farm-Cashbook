import Link from "next/link"
import { ReactNode } from "react"

export default function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  const logo = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon-192.png`

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/login" className="mb-8 flex items-center justify-center gap-2 text-green-800">
          <img src={logo} alt="" className="h-8 w-8" />
          <span className="text-xl font-semibold">Farm Cashbook</span>
        </Link>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h1 className="text-center text-2xl font-semibold text-gray-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-center text-sm text-gray-600">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
