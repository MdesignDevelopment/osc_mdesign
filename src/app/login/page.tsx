import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image src="/logo.png" alt="M.Design" width={52} height={52} className="rounded-xl shadow-sm" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">OSC Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="jira-panel p-7">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
