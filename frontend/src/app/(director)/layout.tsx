import { DirectorSidebar } from "@/features/navigation/components/director-sidebar"

export default function DirectorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="role-theme-director min-h-screen bg-background">
      <DirectorSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
