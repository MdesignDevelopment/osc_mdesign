'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Session } from 'next-auth'
import { LayoutDashboard, ClipboardList, Users, X } from 'lucide-react'
import { cn, avatarColor, ROLE_LABELS } from '@/lib/utils'

interface SidebarProps {
  session: Session
  open: boolean
  onClose: () => void
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/osc', label: 'OSC Requests', icon: ClipboardList },
  { href: '/users', label: 'User Management', icon: Users, adminOnly: true },
]

export function Sidebar({ session, open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = session.user.role === 'ADMIN'
  const userInitial = session.user.name?.charAt(0).toUpperCase() ?? '?'
  const bgColor = avatarColor(session.user.name ?? 'U')

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 w-56 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0',
        'bg-slate-950',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="M.Design" width={26} height={26} className="rounded-md" />
            <span className="text-white font-semibold text-sm tracking-tight">OSC Tracker</span>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-blue-400' : 'text-slate-500')} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="flex-shrink-0 border-t border-white/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0', bgColor)}>
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{session.user.name}</p>
              <p className="text-slate-500 text-[11px] truncate">
                {ROLE_LABELS[session.user.role as keyof typeof ROLE_LABELS]}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
