import { getUserRole } from '@/lib/auth/role'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { MobileSidebar } from '@/components/dashboard/MobileSidebar'
import { Header } from '@/components/dashboard/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = await getUserRole()

  const userData = user ? {
    name: user.user_metadata?.full_name,
    email: user.email,
    avatar_url: user.user_metadata?.avatar_url
  } : undefined

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden border-r bg-card md:block h-full">
        <Sidebar role={role} user={userData} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="md:hidden p-4 border-b flex items-center gap-4">
          <MobileSidebar role={role || 'cs_agent'} />
          <div className="relative h-8 w-32">
            <Image
              src="/logo.svg"
              alt="Método 3A"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto bg-muted/10 p-0">
          {children}
        </main>
      </div>
    </div>
  )
}
