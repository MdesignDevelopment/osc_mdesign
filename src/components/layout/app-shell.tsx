'use client'

import { Session } from 'next-auth'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { useState } from 'react'

interface AppShellProps {
  children: React.ReactNode
  session: Session
}

export function AppShell({ children, session }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F5F7]">
      <Sidebar session={session} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header session={session} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  )
}
