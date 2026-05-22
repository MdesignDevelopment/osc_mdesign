'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { changePasswordSchema, type ChangePasswordInput } from '@/lib/validations'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="jira-field-label block">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { show: boolean; onToggle: () => void }>(
  ({ show, onToggle, ...props }, ref) => (
    <div className="relative">
      <input {...props} ref={ref} type={show ? 'text' : 'password'} className="jira-input pr-10" />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
)
PasswordInput.displayName = 'PasswordInput'

export function ChangePasswordForm() {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  })

  async function onSubmit(data: ChangePasswordInput) {
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/settings/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong')
        return
      }
      setSuccess(true)
      reset()
    } catch {
      setError('Network error. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="jira-panel p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Current Password" error={errors.currentPassword?.message}>
            <PasswordInput
              {...register('currentPassword')}
              show={showCurrent}
              onToggle={() => setShowCurrent(v => !v)}
              autoComplete="current-password"
            />
          </Field>

          <div />

          <Field label="New Password" error={errors.newPassword?.message}>
            <PasswordInput
              {...register('newPassword')}
              show={showNew}
              onToggle={() => setShowNew(v => !v)}
              autoComplete="new-password"
            />
            <p className="text-gray-400 text-xs mt-1">Minimum 12 characters</p>
          </Field>

          <Field label="Confirm New Password" error={errors.confirmPassword?.message}>
            <PasswordInput
              {...register('confirmPassword')}
              show={showConfirm}
              onToggle={() => setShowConfirm(v => !v)}
              autoComplete="new-password"
            />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Password updated successfully.
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button type="submit" disabled={isSubmitting} className="jira-btn-primary">
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Update Password
        </button>
      </div>
    </form>
  )
}
