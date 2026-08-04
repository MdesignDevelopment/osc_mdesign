import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { can, landingRoute } from '@/lib/permissions'
import { Role } from '@prisma/client'

export default async function DesignSessionsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!can(session.user.role as Role, 'design:read')) {
    redirect(landingRoute(session.user.role as Role))
  }
  return <AppShell session={session}>{children}</AppShell>
}
