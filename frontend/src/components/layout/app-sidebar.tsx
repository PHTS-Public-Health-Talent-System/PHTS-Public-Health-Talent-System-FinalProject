"use client";

import * as React from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  FileText,
  History,
  CheckSquare,
  Settings,
  LogOut,
  Bell,
  PieChart,
  Users,
  CreditCard,
  UserCheck,
  ShieldAlert,
  Database,
  SlidersHorizontal
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { usePrefill } from "@/features/request/hooks";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: number;
}

const headHrMenu: MenuItem[] = [
  { title: "หน้าหลัก", url: "/dashboard/head-hr", icon: LayoutDashboard },
  { title: "คำขอรออนุมัติ", url: "/dashboard/head-hr/requests", icon: FileText },
  { title: "ประวัติคำขอ", url: "/dashboard/head-hr/request-history", icon: History },
  { title: "ตรวจสอบเงินเดือน", url: "/dashboard/head-hr/payroll-check", icon: CreditCard },
  { title: "การแจ้งเตือน", url: "/dashboard/head-hr/notifications", icon: Bell },
  { title: "ค้นหา/ตรวจย้อนหลัง", url: "/dashboard/head-hr/history", icon: History },
  { title: "ดาวน์โหลดรายงาน", url: "/dashboard/head-hr/reports", icon: PieChart },
]

const headFinanceMenu: MenuItem[] = [
  { title: "หน้าหลัก", url: "/dashboard/head-finance", icon: LayoutDashboard },
  { title: "คำขอรออนุมัติ", url: "/dashboard/head-finance/requests", icon: FileText },
  { title: "ประวัติคำขอ", url: "/dashboard/head-finance/request-history", icon: History },
  { title: "ตรวจสอบงบประมาณ", url: "/dashboard/head-finance/budget-check", icon: PieChart },
  { title: "ค้นหา/ตรวจย้อนหลัง", url: "/dashboard/head-finance/history", icon: History },
  { title: "ดาวน์โหลดรายงาน", url: "/dashboard/head-finance/reports", icon: PieChart },
]

const roleMenus: Record<string, MenuItem[]> = {
  USER: [
    { title: "หน้าหลัก", url: "/dashboard/user", icon: LayoutDashboard },
    { title: "ยื่นคำขอ", url: "/dashboard/user/requests", icon: FileText },
    { title: "การแจ้งเตือน", url: "/dashboard/user/notifications", icon: Bell },
    { title: "โปรไฟล์", url: "/dashboard/user/profile", icon: UserCheck },
  ],
  HEAD_WARD: [
    { title: "หน้าหลัก", url: "/dashboard/head-ward", icon: LayoutDashboard },
    { title: "จัดการคำขอ", url: "/dashboard/head-ward/requests", icon: UserCheck },
    { title: "ประวัติการอนุมัติ", url: "/dashboard/head-ward/history", icon: History },
    { title: "การแจ้งเตือน", url: "/dashboard/head-ward/notifications", icon: Bell },
  ],
  HEAD_DEPT: [
    { title: "หน้าหลัก", url: "/dashboard/head-dept", icon: LayoutDashboard },
    { title: "จัดการคำขอ", url: "/dashboard/head-dept/requests", icon: UserCheck },
    { title: "ประวัติการอนุมัติ", url: "/dashboard/head-dept/history", icon: History },
    { title: "การแจ้งเตือน", url: "/dashboard/head-dept/notifications", icon: Bell },
  ],
  PTS_OFFICER: [
    { title: "หน้าหลัก", url: "/dashboard/pts-officer", icon: LayoutDashboard },
    { title: "ตรวจสอบเอกสาร", url: "/dashboard/pts-officer/verification", icon: FileText },
    { title: "ประวัติการอนุมัติ", url: "/dashboard/pts-officer/history", icon: UserCheck },
    { title: "การแจ้งเตือน", url: "/dashboard/pts-officer/notifications", icon: Bell },
    { title: "จัดการเงินเดือน", url: "/dashboard/pts-officer/payroll", icon: CreditCard },
    { title: "ค้นหา/ตรวจย้อนหลัง", url: "/dashboard/pts-officer/payroll-history", icon: History },
    { title: "License Alerts", url: "/dashboard/pts-officer/license-alerts", icon: ShieldAlert },
    { title: "Snapshots", url: "/dashboard/pts-officer/snapshots", icon: Database },
    { title: "ตั้งค่าข้อมูลหลัก", url: "/dashboard/pts-officer/master-data", icon: SlidersHorizontal },
  ],
  DIRECTOR: [
    { title: "หน้าหลัก", url: "/dashboard/director", icon: LayoutDashboard },
    { title: "คำขอรออนุมัติ", url: "/dashboard/director/requests", icon: FileText },
    { title: "ประวัติคำขอ", url: "/dashboard/director/request-history", icon: History },
    { title: "อนุมัติการเบิกจ่าย", url: "/dashboard/director/approvals", icon:  CheckSquare},
    { title: "ค้นหา/ตรวจย้อนหลัง", url: "/dashboard/director/history", icon: History },
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
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { data: prefill } = usePrefill();

  const menuItems = user?.role && roleMenus[user.role]
    ? roleMenus[user.role]
    : roleMenus.USER;

  const roleLabels: Record<string, string> = {
    USER: "ผู้ใช้งานทั่วไป",
    HEAD_WARD: "หัวหน้าหอผู้ป่วย",
    HEAD_DEPT: "หัวหน้ากลุ่มงาน",
    PTS_OFFICER: "เจ้าหน้าที่ พ.ต.ส.",
    DIRECTOR: "ผู้อำนวยการ",
    HEAD_HR: "หัวหน้าฝ่าย HR",
    HEAD_FINANCE: "หัวหน้าฝ่ายการเงิน",
    FINANCE_OFFICER: "เจ้าหน้าที่การเงิน",
    ADMIN: "ผู้ดูแลระบบ",
  };

  const displayName = prefill
    ? `${prefill.first_name} ${prefill.last_name}`
    : user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.username || "PHTS User";

  const displaySubtitle = prefill?.position_name || (user?.role ? roleLabels[user.role] : "Personnel");

  const initials = prefill?.first_name
    ? prefill.first_name.substring(0, 1).toUpperCase()
    : user?.firstName
      ? user.firstName.substring(0, 1).toUpperCase()
      : user?.username?.substring(0, 1).toUpperCase() || 'U';

  return (
    <Sidebar collapsible="icon" className="border-r-slate-200" {...props}>
      {/* ส่วนหัว Sidebar: โลโก้ระบบ */}
      <SidebarHeader className="h-16 flex items-center border-b border-slate-100 bg-white px-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
        <div className="flex items-center gap-2 w-full group-data-[collapsible=icon]:justify-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white p-1 border border-slate-100 shadow-sm overflow-hidden text-white">
            <Image
              src="/logo-uttaradit-hospital.png"
              alt="Hospital Logo"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-lg text-slate-900 tracking-tight">PHTS</span>
            <span className="text-[10px] text-slate-500 font-medium">ระบบบริหารจัดการเงิน พ.ต.ส.</span>
          </div>
        </div>
      </SidebarHeader>

      {/* ส่วนเนื้อหาเมนู */}
      <SidebarContent className="bg-white px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-400 font-normal px-2 mb-2">
            เมนูหลัก
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "h-12 text-base font-medium rounded-xl transition-all duration-200",
                        isActive
                          ? "bg-sky-100 text-sky-700 font-semibold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                        "group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
                      )}
                    >
                      <Link href={item.url}>
                        <item.icon
                          className={cn(
                            "h-6 w-6 shrink-0 transition-all",
                            isActive ? "text-sky-600" : "text-slate-400"
                          )}
                        />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-600">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* กลุ่มเมนูตั้งค่า/ช่วยเหลือ */}
        <SidebarGroup className="mt-auto">
           <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                 {(() => {
                   const isActive = pathname === "/dashboard/user/settings";
                   return (
                     <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={cn(
                          "h-12 rounded-xl transition-all duration-200",
                          isActive
                            ? "bg-sky-100 text-sky-700 font-semibold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                          "group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
                        )}
                     >
                        <Link href="/dashboard/user/settings">
                          <Settings className={cn(
                             "h-6 w-6 shrink-0 transition-all",
                             isActive ? "text-sky-600" : "text-slate-400"
                          )} />
                          <span className="group-data-[collapsible=icon]:hidden">ตั้งค่าระบบ</span>
                        </Link>
                     </SidebarMenuButton>
                   );
                 })()}
              </SidebarMenuItem>
            </SidebarMenu>
           </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ส่วนท้าย Sidebar: โปรไฟล์ผู้ใช้ */}
      <SidebarFooter className="bg-white border-t border-slate-100 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-xl hover:bg-slate-50 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <Avatar className="h-9 w-9 shrink-0 rounded-lg bg-sky-100 border border-sky-200 text-sky-700">
                <AvatarFallback className="font-bold text-lg">
                   {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight ml-2 group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold text-slate-900 text-base">
                  {displayName}
                </span>
                <span className="truncate text-xs text-slate-500">
                  {displaySubtitle}
                </span>
              </div>
              <LogOut onClick={logout} className="ml-auto size-4 text-slate-400 hover:text-red-500 cursor-pointer" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
