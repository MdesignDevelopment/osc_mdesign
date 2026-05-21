import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'

export default async function HistoryLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role === 'EXTERN') redirect('/dashboard')
  return <AppShell session={session}>{children}</AppShell>
}
