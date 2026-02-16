import { UserSidebar } from "@/features/navigation/components/user-sidebar"

export const dynamic = 'force-dynamic'

export default function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="role-theme-user min-h-screen bg-background">
      <UserSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
