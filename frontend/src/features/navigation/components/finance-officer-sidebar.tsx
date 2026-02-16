"use client"
import { UnifiedSidebar, type SidebarConfig } from "./unified-sidebar"
import { useAuth } from "@/components/providers/auth-provider"
import { useNavigation } from "@/features/navigation/hooks"
import { mapNavigationItems } from "@/features/navigation/navigation.mappers"

const resolveInitials = (firstName?: string | null, lastName?: string | null) => {
  const first = firstName?.trim()?.charAt(0) ?? ""
  const last = lastName?.trim()?.charAt(0) ?? ""
  return (first + last) || "-"
}

export function FinanceOfficerSidebar() {
  const { user } = useAuth()
  const navigationQuery = useNavigation()

  const baseConfig: Omit<SidebarConfig, "user"> = {
    role: "finance-officer",
    roleLabel: "เจ้าหน้าที่การเงิน",
    roleBgColor: "bg-amber-600",
    navigation: [],
    secondaryNavigation: [],
    secondaryLabel: "รายงาน",
    notificationCount: 0,
  }

  const config: SidebarConfig = (() => {
    const nav = navigationQuery.data
    const badges = nav?.badges
    const displayName = nav?.user?.name
      || [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
      || "ผู้ใช้งาน"
    const title = nav?.user?.title || user?.position || "เจ้าหน้าที่การเงิน"

    return {
      ...baseConfig,
      navigation: nav ? mapNavigationItems(nav.menu, badges) : [],
      secondaryNavigation: nav ? mapNavigationItems(nav.secondaryMenu, badges) : [],
      secondaryLabel: nav?.secondaryLabel || baseConfig.secondaryLabel,
      notificationCount: badges?.notifications ?? 0,
      user: {
        name: displayName,
        title,
        initials: resolveInitials(user?.firstName, user?.lastName),
      },
    }
  })()

  if (navigationQuery.isLoading || navigationQuery.isError) return null
  if (config.navigation.length === 0 && (config.secondaryNavigation?.length ?? 0) === 0) return null

  return <UnifiedSidebar config={config} />
}
