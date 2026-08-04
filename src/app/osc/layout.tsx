import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { can, landingRoute } from '@/lib/permissions'
import { Role } from '@prisma/client'

export default async function OscLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  // The OSC list was previously reachable by any signed-in user. Roles without
  // osc:read (WM_SUPPORT_ENGINEER) must not see it at all.
  if (!can(session.user.role as Role, 'osc:read')) redirect(landingRoute(session.user.role as Role))
  return <AppShell session={session}>{children}</AppShell>
}
