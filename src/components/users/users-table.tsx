'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Role } from '@prisma/client'
import { formatDate, avatarColor } from '@/lib/utils'
import { RoleLozenge } from '@/components/ui/lozenge'
import { UserPlus, Pencil, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import { UserFormDialog } from './user-form-dialog'

interface UserRow {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  createdAt: Date
  _count: { oscRequests: number; comments: number }
}

interface UsersTableProps {
  users: UserRow[]
}

function UserAvatar({ name }: { name: string }) {
  const bg = avatarColor(name)
  return (
    <div className={`w-7 h-7 ${bg} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export function UsersTable({ users }: UsersTableProps) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ open: boolean; user?: UserRow }>({ open: false })
  const [toggling, setToggling] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleToggleActive = async (user: UserRow) => {
    setToggling(user.id)
    await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !user.active }),
    })
    setToggling(null)
    startTransition(() => router.refresh())
  }

  return (
    <>
      <div className="jira-panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="jira-section-header mb-0">All Users</p>
          <button onClick={() => setDialog({ open: true })} className="jira-btn-primary text-xs">
            <UserPlus className="w-3.5 h-3.5" />
            Add User
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="jira-table-header">User</th>
                <th className="jira-table-header">Role</th>
                <th className="jira-table-header">Status</th>
                <th className="jira-table-header">OSC Requests</th>
                <th className="jira-table-header">Comments</th>
                <th className="jira-table-header">Joined</th>
                <th className="jira-table-header w-16"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="jira-table-row">
                  <td className="jira-table-cell">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={user.name} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="jira-table-cell whitespace-nowrap">
                    <RoleLozenge role={user.role} />
                  </td>
                  <td className="jira-table-cell whitespace-nowrap">
                    <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                      user.active
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="jira-table-cell text-slate-600">{user._count.oscRequests}</td>
                  <td className="jira-table-cell text-slate-600">{user._count.comments}</td>
                  <td className="jira-table-cell text-slate-400 whitespace-nowrap">{formatDate(user.createdAt)}</td>
                  <td className="jira-table-cell">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDialog({ open: true, user })}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Edit user"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={toggling === user.id}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                        title={user.active ? 'Deactivate' : 'Activate'}
                      >
                        {toggling === user.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : user.active
                            ? <ToggleRight className="w-3.5 h-3.5 text-emerald-500" />
                            : <ToggleLeft className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UserFormDialog
        open={dialog.open}
        user={dialog.user}
        onClose={() => setDialog({ open: false })}
        onSuccess={() => {
          setDialog({ open: false })
          startTransition(() => router.refresh())
        }}
      />
    </>
  )
}
