"use client"

import * as React from "react"
import {
  LayoutDashboard,
  FileText,
  Settings,
  Users,
  LogOut,
  PieChart,
  CreditCard,
  Building2,
  UserCheck,
  Bell,
  ShieldAlert,
  Database,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/providers/auth-provider"
import Link from "next/link"
import { usePathname } from "next/navigation"

const headHrMenu = [
  { title: "หน้าหลัก", url: "/dashboard/head-hr", icon: LayoutDashboard },
  { title: "คำขอรออนุมัติ", url: "/dashboard/head-hr/requests", icon: FileText },
  { title: "ประวัติคำขอ", url: "/dashboard/head-hr/request-history", icon: FileText },
  { title: "ตรวจสอบเงินเดือน", url: "/dashboard/head-hr/payroll-check", icon: CreditCard },
  { title: "การแจ้งเตือน", url: "/dashboard/head-hr/notifications", icon: Bell },
  { title: "ค้นหา/ตรวจย้อนหลัง", url: "/dashboard/head-hr/history", icon: FileText },
  { title: "ดาวน์โหลดรายงาน", url: "/dashboard/head-hr/reports", icon: FileText },
]

const headFinanceMenu = [
  { title: "หน้าหลัก", url: "/dashboard/head-finance", icon: LayoutDashboard },
  { title: "คำขอรออนุมัติ", url: "/dashboard/head-finance/requests", icon: FileText },
  { title: "ประวัติคำขอ", url: "/dashboard/head-finance/request-history", icon: FileText },
  { title: "ตรวจสอบงบประมาณ", url: "/dashboard/head-finance/budget-check", icon: PieChart },
  { title: "ค้นหา/ตรวจย้อนหลัง", url: "/dashboard/head-finance/history", icon: FileText },
  { title: "ดาวน์โหลดรายงาน", url: "/dashboard/head-finance/reports", icon: FileText },
]

// Determine menu items based on Role
const roleMenus = {
  USER: [
    { title: "หน้าหลัก", url: "/dashboard/user", icon: LayoutDashboard },
    { title: "ยื่นคำขอ", url: "/dashboard/user/requests", icon: FileText },
    { title: "การแจ้งเตือน", url: "/dashboard/user/notifications", icon: Bell },
    { title: "โปรไฟล์", url: "/dashboard/user/profile", icon: Settings },
  ],
  HEAD_WARD: [
    { title: "หน้าหลัก", url: "/dashboard/head-ward", icon: LayoutDashboard },
    { title: "จัดการคำขอ", url: "/dashboard/head-ward/requests", icon: UserCheck },
    { title: "ประวัติการอนุมัติ", url: "/dashboard/head-ward/history", icon: FileText },
    { title: "การแจ้งเตือน", url: "/dashboard/head-ward/notifications", icon: Bell },
  ],
  HEAD_DEPT: [
    { title: "หน้าหลัก", url: "/dashboard/head-dept", icon: LayoutDashboard },
    { title: "จัดการคำขอ", url: "/dashboard/head-dept/requests", icon: UserCheck },
    { title: "ประวัติการอนุมัติ", url: "/dashboard/head-dept/history", icon: FileText },
    { title: "การแจ้งเตือน", url: "/dashboard/head-dept/notifications", icon: Bell },
  ],
  PTS_OFFICER: [
    { title: "หน้าหลัก", url: "/dashboard/pts-officer", icon: LayoutDashboard },
    { title: "ตรวจสอบเอกสาร", url: "/dashboard/pts-officer/verification", icon: FileText },
    { title: "ประวัติการอนุมัติ", url: "/dashboard/pts-officer/history", icon: UserCheck },
    { title: "การแจ้งเตือน", url: "/dashboard/pts-officer/notifications", icon: Bell },
    { title: "จัดการเงินเดือน", url: "/dashboard/pts-officer/payroll", icon: CreditCard },
    { title: "ค้นหา/ตรวจย้อนหลัง", url: "/dashboard/pts-officer/payroll-history", icon: FileText },
    { title: "Data Quality", url: "/dashboard/pts-officer/data-quality", icon: ShieldCheck },
    { title: "License Alerts", url: "/dashboard/pts-officer/license-alerts", icon: ShieldAlert },
    { title: "Snapshots", url: "/dashboard/pts-officer/snapshots", icon: Database },
    { title: "ตั้งค่าข้อมูลหลัก", url: "/dashboard/pts-officer/master-data", icon: SlidersHorizontal },
  ],
  DIRECTOR: [
    { title: "หน้าหลัก", url: "/dashboard/director", icon: LayoutDashboard },
    { title: "คำขอรออนุมัติ", url: "/dashboard/director/requests", icon: FileText },
    { title: "ประวัติคำขอ", url: "/dashboard/director/request-history", icon: FileText },
    { title: "อนุมัติการเบิกจ่าย", url: "/dashboard/director/approvals", icon:  FileText},
    { title: "ค้นหา/ตรวจย้อนหลัง", url: "/dashboard/director/history", icon: FileText },
    { title: "ดาวน์โหลดรายงาน", url: "/dashboard/director/reports", icon: PieChart },
  ],
  HEAD_HR: headHrMenu,
  HEAD_FINANCE: headFinanceMenu,
  FINANCE_OFFICER: [
      { title: "หน้าหลัก", url: "/dashboard/finance-officer", icon: LayoutDashboard },
      { title: "รายการโอนเงิน", url: "/dashboard/finance-officer/payments", icon: CreditCard },
      { title: "ส่งออกข้อมูล", url: "/dashboard/finance-officer/export", icon: FileText },
  ],
  ADMIN: [
      { title: "Audit Logs", url: "/dashboard/admin/audit-logs", icon: FileText },
      { title: "จัดการผู้ใช้", url: "/dashboard/admin/users", icon: Users },
      { title: "Snapshots", url: "/dashboard/admin/snapshots", icon: Settings },
  ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  // Select menu based on user role (default to USER if not found)
  const menus = user?.role && roleMenus[user.role]
    ? roleMenus[user.role]
    : roleMenus.USER

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">PHTS System</span>
            <span className="truncate text-xs">รพ.อุตรดิตถ์</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {menus.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={pathname.startsWith(item.url)}
                className="hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary data-[active=true]:text-white"
              >
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
             <div className="flex items-center gap-3 p-2">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src="" />
                  <AvatarFallback className="rounded-lg">
                    {user?.username?.substring(0, 2).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user?.username}</span>
                  <span className="truncate text-xs text-muted-foreground">{user?.role}</span>
                </div>
             </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} className="text-destructive hover:bg-destructive/10">
              <LogOut />
              <span>ออกจากระบบ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
