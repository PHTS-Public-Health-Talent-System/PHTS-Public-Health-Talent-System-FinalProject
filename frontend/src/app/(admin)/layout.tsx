import { AdminSidebar } from "@/features/navigation/components/admin-sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="role-theme-admin min-h-screen bg-background">
      <AdminSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
