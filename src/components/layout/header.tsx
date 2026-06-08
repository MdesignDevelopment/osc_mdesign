'use client'

import { Session } from 'next-auth'
import { signOut } from 'next-auth/react'
import { Menu, LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface HeaderProps {
  session: Session
  onMenuClick: () => void
}

export function Header({ session, onMenuClick }: HeaderProps) {
  return (
    <header className="bg-white dark:bg-[#111113] border-b border-[#e4e4e7] dark:border-[#27272a] h-12 flex items-center justify-between px-4 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.07] transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2 ml-auto">
        <ThemeToggle />
        <div className="w-px h-4 bg-[#e4e4e7] dark:bg-[#27272a] hidden sm:block" />
        <span className="text-[13px] text-neutral-400 dark:text-neutral-500 hidden sm:block">
          {session.user.email}
        </span>
        <div className="w-px h-4 bg-[#e4e4e7] dark:bg-[#27272a] hidden sm:block" />
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-1.5 text-[13px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.07] transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </header>
  )
}
