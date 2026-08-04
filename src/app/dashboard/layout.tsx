import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { can, landingRoute } from '@/lib/permissions'
import { Role } from '@prisma/client'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  // The dashboard is entirely OSC aggregates, so it is gated on osc:read
  // rather than being a universal landing page. See SPEC-WYER-MERKATOR.md §4.5.
  if (!can(session.user.role as Role, 'osc:read')) redirect(landingRoute(session.user.role as Role))

  return <AppShell session={session}>{children}</AppShell>
}
