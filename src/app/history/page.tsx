import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Role } from '@prisma/client'
import { can, landingRoute, type Capability } from '@/lib/permissions'
import { HistoryTabs, type HistoryTab, type HistoryTabKey } from '@/components/history/history-tabs'
import { OscHistoryView } from '@/components/history/osc-history-view'
import { AuditHistoryView } from '@/components/history/audit-history-view'

// Module-tabbed change history.
//
// Capability enforcement happens HERE, server-side, not by hiding tabs: a
// WM_SUPPORT_ENGINEER hitting /history?entity=OSC_REQUEST must be redirected,
// not served OSC data. See SPEC-WYER-MERKATOR.md §5.4.

const TAB_CAPABILITY: Record<HistoryTabKey, Capability> = {
  OSC_REQUEST: 'audit:read:osc',
  DESIGN_SESSION: 'audit:read:design',
  ADDRESS_REQUEST: 'audit:read:address',
}

const ALL_TABS: readonly HistoryTab[] = [
  { key: 'OSC_REQUEST', label: 'OSC Requests' },
  { key: 'DESIGN_SESSION', label: 'Design Sessions' },
  { key: 'ADDRESS_REQUEST', label: 'Addresses' },
]

function isTabKey(value: string | undefined): value is HistoryTabKey {
  return value === 'OSC_REQUEST' || value === 'DESIGN_SESSION' || value === 'ADDRESS_REQUEST'
}

interface PageProps {
  searchParams: {
    entity?: string
    user?: string
    popzone?: string
    label?: string
    from?: string
    to?: string
    page?: string
  }
}

export default async function HistoryPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const role = session.user.role as Role
  const tabs = ALL_TABS.filter((t) => can(role, TAB_CAPABILITY[t.key]))

  // The layout already guarantees at least one audit capability, but never
  // assume that from here.
  if (tabs.length === 0) redirect(landingRoute(role))

  const requested = searchParams.entity
  // An explicit request for a module the role cannot audit is a redirect, not a
  // silent fallback — falling back quietly would look like the data was empty.
  if (requested !== undefined && (!isTabKey(requested) || !can(role, TAB_CAPABILITY[requested]))) {
    redirect('/history')
  }

  // Default to the first tab the user can actually see, not a hardcoded module.
  const active: HistoryTabKey = isTabKey(requested) ? requested : tabs[0].key

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Change History</h1>

      <HistoryTabs tabs={tabs} active={active} preserved={searchParams} />

      {active === 'OSC_REQUEST' ? (
        <OscHistoryView searchParams={{ ...searchParams, entity: active }} />
      ) : (
        <AuditHistoryView entity={active} searchParams={{ ...searchParams, entity: active }} />
      )}
    </div>
  )
}
