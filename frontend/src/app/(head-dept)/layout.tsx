import React from "react"
import { HeadDeptSidebar } from "@/features/navigation/components/head-dept-sidebar"

export default function HeadDeptLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="role-theme-head-dept min-h-screen bg-background">
      <HeadDeptSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
