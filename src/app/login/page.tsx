import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f5f5f7] dark:bg-[#0d0d0f]">
      <div className="w-full max-w-[380px]">

        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white dark:bg-[#111113] border border-[#e4e4e7] dark:border-[#27272a] shadow-sm mb-4">
            <Image src="/logo.png" alt="M.Design" width={28} height={28} className="rounded-md" />
          </div>
          <h1 className="text-[22px] font-semibold text-[#09090b] dark:text-[#fafafa] tracking-tight">
            OSC Tracker
          </h1>
          <p className="text-[13px] text-[#a1a1aa] mt-1">Sign in to continue</p>
        </div>

        <div className="jira-panel p-6 shadow-sm">
          <LoginForm />
        </div>

      </div>
    </div>
  )
}
