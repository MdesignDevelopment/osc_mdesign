'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Session } from 'next-auth'
import { LayoutDashboard, ClipboardList, LayoutGrid, MapPin, Users, History, Settings, Plug, X } from 'lucide-react'
import { cn, avatarColor, ROLE_LABELS_SHORT } from '@/lib/utils'
import { can, canAny, AUDIT_CAPABILITIES, type Capability } from '@/lib/permissions'
import { Role } from '@prisma/client'

interface SidebarProps {
  session: Session
  open: boolean
  onClose: () => void
}

// Nav visibility is capability-driven, not role-driven: a new role declares its
// capabilities once in lib/permissions and the nav follows. The previous
// `adminOnly` / `noExtern` flags meant every new role saw everything by default.
// See SPEC-WYER-MERKATOR.md §4.5.
type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /** Required capability; `null` means every signed-in user. */
  capability: Capability | null
  /** Visible when the role holds ANY of these (used by the history page). */
  anyCapability?: readonly Capability[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, capability: 'osc:read' },
  { href: '/osc', label: 'OSC Requests', icon: ClipboardList, capability: 'osc:read' },
  { href: '/design-sessions', label: 'Design Sessions', icon: LayoutGrid, capability: 'design:read' },
  { href: '/addresses', label: 'Addresses', icon: MapPin, capability: 'address:read' },
  { href: '/history', label: 'Change History', icon: History, capability: null, anyCapability: AUDIT_CAPABILITIES },
  { href: '/users', label: 'User Management', icon: Users, capability: 'users:manage' },
  { href: '/api-integration', label: 'API Integration', icon: Plug, capability: 'api:integration' },
  { href: '/settings', label: 'Settings', icon: Settings, capability: null },
]

export function Sidebar({ session, open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const role = session.user.role as Role
  const userInitial = session.user.name?.charAt(0).toUpperCase() ?? '?'
  const bgColor = avatarColor(session.user.name ?? 'U')

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 w-[220px] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0',
        'bg-[#111] border-r border-white/[0.06]',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="M.Design" width={22} height={22} className="rounded" />
            <span className="text-white/90 font-semibold text-sm tracking-tight">OSC Tracker</span>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded text-white/30 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            if (item.anyCapability ? !canAny(role, item.anyCapability) : false) return null
            if (item.capability && !can(role, item.capability)) return null
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-[15px] transition-colors',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.06]'
                )}
              >
                <Icon className={cn('w-5 h-5 flex-shrink-0', active ? 'text-blue-400' : 'text-white/30')} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="flex-shrink-0 border-t border-white/[0.06] px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0', bgColor)}>
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-white/80 text-xs font-medium truncate">{session.user.name}</p>
              <p className="text-white/30 text-[11px] truncate">
                {ROLE_LABELS_SHORT[role]}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
