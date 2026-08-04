import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { can, landingRoute } from '@/lib/permissions'
import { Role } from '@prisma/client'

export default async function ApiIntegrationLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  // This page displays the live daily-rotating data-API key. It previously had
  // no capability guard at all — the nav entry was hidden for some roles, but
  // the URL was reachable by any signed-in user, including EXTERN.
  if (!can(session.user.role as Role, 'api:integration')) {
    redirect(landingRoute(session.user.role as Role))
  }
  return <AppShell session={session}>{children}</AppShell>
}
