import React from "react"
import { HeadFinanceSidebar } from "@/features/navigation/components/head-finance-sidebar"

export default function HeadFinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="role-theme-head-finance min-h-screen bg-background">
      <HeadFinanceSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
