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
    <header className="bg-white border-b border-[#DFE1E6] h-12 flex items-center justify-between px-4 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded text-[#42526E] hover:bg-[#F4F5F7] transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3 ml-auto">
        <span className="text-sm text-[#6B778C] hidden sm:block">{session.user.email}</span>
        <div className="w-px h-4 bg-[#DFE1E6] hidden sm:block" />
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-1.5 text-sm text-[#42526E] hover:text-[#BF2600] px-2 py-1 rounded hover:bg-[#FFEBE6] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </header>
  )
}
