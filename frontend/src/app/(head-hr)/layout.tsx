import React from "react"
import { HeadHRSidebar } from "@/features/navigation/components/head-hr-sidebar"

export default function HeadHRLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="role-theme-head-hr min-h-screen bg-background">
      <HeadHRSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
