"use client"
import { UnifiedSidebar, type SidebarConfig } from "./unified-sidebar"
import { useAuth } from "@/components/providers/auth-provider"
import { useNavigation } from "@/features/navigation/hooks"
import { mapNavigationItems } from "@/features/navigation/navigation.mappers"

const baseConfig: Omit<SidebarConfig, "user"> = {
  role: "pts-officer",
  roleLabel: "เจ้าหน้าที่ พ.ต.ส.",
  roleBgColor: "bg-primary",
  navigation: [],
  secondaryNavigation: [],
  secondaryLabel: "ข้อมูลหลัก",
  notificationCount: 0,
}

function getInitials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2)
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`
}

export function PtsOfficerSidebar() {
  const { user } = useAuth()
  const navigationQuery = useNavigation()
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
  const name = displayName || user?.username || "ผู้ใช้งาน"
  const title = user?.position || baseConfig.roleLabel

  const config: SidebarConfig = (() => {
    const nav = navigationQuery.data
    const badges = nav?.badges

    return {
      ...baseConfig,
      navigation: nav ? mapNavigationItems(nav.menu, badges) : [],
      secondaryNavigation: nav ? mapNavigationItems(nav.secondaryMenu, badges) : [],
      secondaryLabel: nav?.secondaryLabel || baseConfig.secondaryLabel,
      notificationCount: badges?.notifications ?? 0,
      user: {
        name: nav?.user?.name || name,
        title: nav?.user?.title || title,
        initials: getInitials(nav?.user?.name || name),
      },
    }
  })()

  if (navigationQuery.isLoading) {
    return null
  }

  if (navigationQuery.isError) {
    return null
  }

  if (config.navigation.length === 0 && (config.secondaryNavigation?.length ?? 0) === 0) {
    return null
  }

  return <UnifiedSidebar config={config} />
}
