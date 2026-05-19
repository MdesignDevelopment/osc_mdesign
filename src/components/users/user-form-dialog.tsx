'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { userCreateSchema, userUpdateSchema, UserCreateInput, UserUpdateInput } from '@/lib/validations'
import { Role } from '@prisma/client'
import { X, Loader2 } from 'lucide-react'

interface UserRow {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
}

interface UserFormDialogProps {
  open: boolean
  user?: UserRow
  onClose: () => void
  onSuccess: () => void
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="jira-field-label block">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

export function UserFormDialog({ open, user, onClose, onSuccess }: UserFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!user

  const schema = isEdit ? userUpdateSchema : userCreateSchema
  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserCreateInput | UserUpdateInput>({
    resolver: zodResolver(schema as Parameters<typeof zodResolver>[0]),
  })

  useEffect(() => {
    if (open) {
      setError(null)
      reset(
        user
          ? { name: user.name, email: user.email, role: user.role, password: '' }
          : { name: '', email: '', role: 'SUPPORT_ENGINEER', password: '' }
      )
    }
  }, [open, user, reset])

  const onSubmit = async (data: UserCreateInput | UserUpdateInput) => {
    setLoading(true)
    setError(null)
    try {
      const payload = { ...data }
      if (isEdit && !(payload as UserUpdateInput).password) {
        delete (payload as UserUpdateInput).password
      }
      const res = await fetch(isEdit ? `/api/users/${user!.id}` : '/api/users', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Something went wrong')
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const e = errors as Record<string, { message?: string }>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full max-w-md rounded-xl shadow-xl border border-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            {isEdit ? 'Edit User' : 'Create User'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <Field label="Full Name *" error={e.name?.message}>
            <input {...register('name')} type="text" placeholder="Jane Doe" className="jira-input" />
          </Field>

          <Field label="Email *" error={e.email?.message}>
            <input {...register('email')} type="email" placeholder="jane@example.com" className="jira-input" />
          </Field>

          <Field
            label={isEdit ? 'Password (leave blank to keep current)' : 'Password *'}
            error={e.password?.message}
          >
            <input
              {...register('password')}
              type="password"
              placeholder={isEdit ? '••••••••' : 'Min 6 characters'}
              className="jira-input"
            />
          </Field>

          <Field label="Role *" error={e.role?.message}>
            <select {...register('role')} className="jira-input">
              <option value="ADMIN">Admin</option>
              <option value="SUPPORT_ENGINEER">Support Engineer</option>
              <option value="EXTERN">External</option>
            </select>
          </Field>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={loading} className="jira-btn-primary">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create User'}
            </button>
            <button type="button" onClick={onClose} className="text-sm text-blue-600 hover:underline px-1">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
