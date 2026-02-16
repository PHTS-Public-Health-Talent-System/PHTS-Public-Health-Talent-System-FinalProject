import React from "react"
import { HeadWardSidebar } from "@/features/navigation/components/head-ward-sidebar"

export default function HeadWardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="role-theme-head-ward min-h-screen bg-background">
      <HeadWardSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
