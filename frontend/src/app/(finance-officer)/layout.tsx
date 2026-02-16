import { FinanceOfficerSidebar } from "@/features/navigation/components/finance-officer-sidebar"
export const dynamic = 'force-dynamic'


export default function FinanceOfficerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="role-theme-finance-officer min-h-screen bg-background">
      <FinanceOfficerSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
