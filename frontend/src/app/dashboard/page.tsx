"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login")
        return
      }

      // Role-based redirection logic
      switch (user.role) {
        case "USER":
          router.push("/dashboard/user")
          break
        case "HEAD_WARD":
          router.push("/dashboard/head-ward")
          break
        case "HEAD_DEPT":
          router.push("/dashboard/head-dept")
          break
        case "PTS_OFFICER":
          router.push("/dashboard/pts-officer")
          break
        case "DIRECTOR":
          router.push("/dashboard/director")
          break
        case "HEAD_HR":
          router.push("/dashboard/head-hr")
          break
        case "HEAD_FINANCE":
          router.push("/dashboard/head-finance")
          break
        case "FINANCE_OFFICER":
          router.push("/dashboard/finance-officer")
          break
        case "ADMIN":
          router.push("/dashboard/admin")
          break
        default:
          router.push("/dashboard/user") // Default fallback
      }
    }
  }, [user, isLoading, router])

  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
         <p className="text-muted-foreground text-sm">กำลังนำท่านเข้าสู่ระบบ...</p>
      </div>
    </div>
  )
}
