
import { ReactNode } from 'react'
import LogoutButton from './LogoutButton'
import Link from 'next/link'

export default function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: '220px', background: '#f4f4f4', padding: '1rem' }}>
        <h2>Farm Cashbook</h2>
        <nav style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/expenses">Expenses</Link>
          <Link href="/payments">Payments</Link>
          <Link href="/parties">Parties</Link>
          <Link href="/statement">Statements</Link>
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <LogoutButton />
        </div>
      </aside>
      <main style={{ flex: 1, padding: '2rem' }}>{children}</main>
    </div>
  )
}
