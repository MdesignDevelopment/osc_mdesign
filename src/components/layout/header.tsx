'use client'

import { Session } from 'next-auth'
import { signOut } from 'next-auth/react'
import { Menu, LogOut } from 'lucide-react'

interface HeaderProps {
  session: Session
  onMenuClick: () => void
}

export function Header({ session, onMenuClick }: HeaderProps) {
  return (
    <header className="bg-white dark:bg-[#111] border-b border-neutral-200 dark:border-white/8 h-12 flex items-center justify-between px-4 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-md text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3 ml-auto">
        <span className="text-sm text-neutral-400 dark:text-neutral-500 hidden sm:block">{session.user.email}</span>
        <div className="w-px h-4 bg-neutral-200 dark:bg-white/10 hidden sm:block" />
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </header>
  )
}
