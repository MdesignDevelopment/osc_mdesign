import { ChangePasswordForm } from '@/components/settings/change-password-form'

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account preferences</p>
      </div>
      <ChangePasswordForm />
    </div>
  )
}
