"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ReactNode, useEffect, useState } from "react"
import {
  BarChart3,
  FileText,
  Home,
  Menu,
  PlusCircle,
  Shield,
  User,
  Users,
  Wallet,
  Zap,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: typeof Home
  admin?: boolean
}

const bookItems: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/statements", label: "Statements", icon: FileText },
  { href: "/electricity-bills", label: "Bills", icon: Zap },
  { href: "/electricity-usage-graph", label: "Usage", icon: BarChart3, admin: true },
  { href: "/add-expense", label: "Add expense", icon: PlusCircle, admin: true },
  { href: "/add-payment", label: "Add payment", icon: Wallet, admin: true },
]

const adminItems: NavItem[] = [
  { href: "/manage-parties", label: "Parties", icon: Users },
  { href: "/manage-users", label: "Users", icon: Users },
  { href: "/manage-roles", label: "Roles", icon: Shield },
  { href: "/audit-logs", label: "Audit logs", icon: FileText },
  { href: "/publishing", label: "Publishing", icon: FileText },
]

const bottomItems = [
  bookItems[0],
  bookItems[1],
  bookItems[2],
]

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  onNavigate?: () => void
}) {
  const active = isActive(pathname, item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-9 items-center gap-2 rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-accent font-medium text-accent-foreground" : "text-gray-700 hover:bg-gray-100"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { session, loading, signOut, supabase } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const logo = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon-192.png`

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    const checkAdmin = async () => {
      if (!session?.user) {
        setIsAdmin(false)
        return
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle()
      if (error) {
        console.error("Could not read user role:", error)
        setIsAdmin(false)
        return
      }
      setIsAdmin(data?.role === "admin")
    }
    checkAdmin()
  }, [session, supabase])

  const visibleBooks = bookItems.filter((item) => !item.admin || isAdmin)
  const moreItems = [...visibleBooks.filter((item) => !bottomItems.includes(item)), ... (isAdmin ? adminItems : [])]
  const moreActive = !!session && !bottomItems.some((item) => isActive(pathname, item.href))

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-gray-200 bg-white md:flex">
        <Link href="/dashboard" className="flex h-16 items-center gap-2 px-4 text-green-800">
          <img src={logo} alt="" className="h-8 w-8" />
          <span className="text-base font-semibold">Farm Cashbook</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4" aria-label="Main">
          {loading ? null : session ? (
            <>
              {isAdmin ? (
                <div className="flex flex-col gap-0.5">
                  <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Admin</p>
                  {adminItems.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              ) : null}
              <div className="flex flex-col gap-0.5">
                <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Books</p>
                {visibleBooks.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
                <NavLink item={{ href: "/dashboard/profile", label: "Profile", icon: User }} pathname={pathname} />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 px-1">
              <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                Sign in
              </Link>
              <Link href="/signup" className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-white px-3 text-sm font-medium text-gray-800">
                Create account
              </Link>
            </div>
          )}
        </nav>
        {session && !loading ? (
          <div className="border-t border-gray-200 p-3">
            <button
              type="button"
              onClick={() => signOut()}
              className="flex min-h-11 w-full items-center rounded-md px-3 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </aside>

      <div className="flex min-h-screen w-full flex-col md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-gray-200 bg-white px-4 md:hidden">
          <img src={logo} alt="" className="h-7 w-7" />
          <span className="font-semibold text-green-800">Farm Cashbook</span>
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white md:hidden" aria-label="Mobile">
        {!loading && session ? (
          <div className="grid grid-cols-4">
            {bottomItems.map((item) => {
              const active = isActive(pathname, item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs",
                    active ? "font-medium text-green-800" : "text-gray-600"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </Link>
              )
            })}
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="mobile-more"
              onClick={() => setMoreOpen((open) => !open)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs",
                moreOpen || moreActive ? "font-medium text-green-800" : "text-gray-600"
              )}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
              More
            </button>
          </div>
        ) : !loading ? (
          <div className="grid grid-cols-2">
            <Link href="/login" className="flex min-h-14 items-center justify-center text-sm font-medium text-green-800">
              Sign in
            </Link>
            <Link href="/signup" className="flex min-h-14 items-center justify-center text-sm text-gray-700">
              Create account
            </Link>
          </div>
        ) : (
          <div className="min-h-14" />
        )}
      </nav>

      {moreOpen && session ? (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setMoreOpen(false)}
          />
          <div id="mobile-more" className="fixed inset-x-0 bottom-14 z-50 max-h-[70vh] overflow-y-auto rounded-t-lg border border-gray-200 bg-white p-3">
            <div className="flex flex-col gap-1">
              {isAdmin ? (
                <>
                  <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Admin</p>
                  {adminItems.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
                  ))}
                </>
              ) : null}
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-500">Books</p>
              {moreItems.filter((item) => !adminItems.some((admin) => admin.href === item.href)).map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
              ))}
              <NavLink
                item={{ href: "/dashboard/profile", label: "Profile", icon: User }}
                pathname={pathname}
                onNavigate={() => setMoreOpen(false)}
              />
              <button
                type="button"
                onClick={() => signOut()}
                className="flex min-h-11 items-center rounded-md px-3 text-sm text-gray-700 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
