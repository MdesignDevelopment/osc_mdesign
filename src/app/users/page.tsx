import { prisma } from '@/lib/db'
import { UsersTable } from '@/components/users/users-table'

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      _count: { select: { oscRequests: true, comments: true } },
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">{users.length} users</p>
      </div>
      <UsersTable users={users} />
    </div>
  )
}
