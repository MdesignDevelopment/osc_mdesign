import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { canAny, landingRoute, AUDIT_CAPABILITIES } from '@/lib/permissions'
import { Role } from '@prisma/client'

export default async function HistoryLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  // Any audit capability grants the page; the page itself decides which module
  // tabs are visible and validates the `entity` param (spec §5.4).
  if (!canAny(session.user.role as Role, AUDIT_CAPABILITIES)) {
    redirect(landingRoute(session.user.role as Role))
  }
  return <AppShell session={session}>{children}</AppShell>
}
