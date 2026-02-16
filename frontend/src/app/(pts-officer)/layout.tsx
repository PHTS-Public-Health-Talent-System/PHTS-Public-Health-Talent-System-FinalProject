import React from "react"
import { PtsOfficerSidebar } from "@/features/navigation/components/pts-officer-sidebar"

export const dynamic = 'force-dynamic'

export default function PTSOfficerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="role-theme-pts-officer min-h-screen bg-background">
      <PtsOfficerSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
