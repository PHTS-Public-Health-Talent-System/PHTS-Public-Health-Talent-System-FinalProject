import { UserRole } from "@/types/auth.js";

export type NavigationBadgeKey =
  | "notifications"
  | "pendingRequests"
  | "pendingPayroll";

export type NavigationItem = {
  label: string;
  href: string;
  iconKey: string;
  badgeKey?: NavigationBadgeKey;
};

const roleBasePath: Partial<Record<UserRole, string>> = {
  [UserRole.USER]: "/user",
  [UserRole.HEAD_SCOPE]: "/head-scope",
  [UserRole.PTS_OFFICER]: "/pts-officer",
  [UserRole.HEAD_HR]: "/head-hr",
  [UserRole.HEAD_FINANCE]: "/head-finance",
  [UserRole.FINANCE_OFFICER]: "/finance-officer",
  [UserRole.DIRECTOR]: "/director",
  [UserRole.ADMIN]: "/admin",
};

const buildApprovalFlowMenu = (basePath: string): NavigationItem[] => [
  { label: "แดชบอร์ด", href: basePath, iconKey: "LayoutDashboard" },
  {
    label: "คำขอรออนุมัติ",
    href: `${basePath}/requests`,
    iconKey: "FileCheck",
    badgeKey: "pendingRequests",
  },
  {
    label: "รอบจ่ายเงิน",
    href: `${basePath}/payroll`,
    iconKey: "Calculator",
    badgeKey: "pendingPayroll",
  },
  {
    label: "ประวัติการอนุมัติ",
    href: `${basePath}/history`,
    iconKey: "Clock",
  },
];

const buildHeadScopeMenu = (basePath: string): NavigationItem[] => [
  { label: "แดชบอร์ด", href: basePath, iconKey: "LayoutDashboard" },
  {
    label: "คำขอรออนุมัติ",
    href: `${basePath}/requests`,
    iconKey: "FileCheck",
    badgeKey: "pendingRequests",
  },
  {
    label: "ขอบเขตการดูแล",
    href: `${basePath}/scopes`,
    iconKey: "Users",
  },
  {
    label: "ประวัติการอนุมัติ",
    href: `${basePath}/history`,
    iconKey: "Clock",
  },
];

export const buildMenu = (
  role: UserRole,
): {
  menu: NavigationItem[];
  secondaryMenu?: NavigationItem[];
  secondaryLabel?: string;
} => {
  const basePath = roleBasePath[role];

  if (!basePath) {
    throw new Error(`Unsupported navigation role: ${role}`);
  }

  switch (role) {
    case UserRole.USER:
      return {
        menu: [
          { label: "แดชบอร์ด", href: basePath, iconKey: "LayoutDashboard" },
          {
            label: "คำขอของฉัน",
            href: `${basePath}/my-requests`,
            iconKey: "FileText",
            badgeKey: "pendingRequests",
          },
        ],
        secondaryMenu: [
          { label: "โปรไฟล์", href: `${basePath}/profile`, iconKey: "User" },
        ],
        secondaryLabel: "บัญชีผู้ใช้",
      };
    case UserRole.HEAD_HR:
      return {
        menu: [
          { label: "แดชบอร์ด", href: basePath, iconKey: "LayoutDashboard" },
          {
            label: "คำขอรออนุมัติ",
            href: `${basePath}/requests`,
            iconKey: "FileCheck",
            badgeKey: "pendingRequests",
          },
          {
            label: "รอบจ่ายเงิน",
            href: `${basePath}/payroll`,
            iconKey: "Calculator",
            badgeKey: "pendingPayroll",
          },
          {
            label: "ประวัติการอนุมัติ",
            href: `${basePath}/history`,
            iconKey: "Clock",
          },
        ],
        secondaryMenu: [
          {
            label: "รายงานกำหนดเวลาอนุมัติ",
            href: `${basePath}/sla-report`,
            iconKey: "ClipboardList",
          },
          {
            label: "ดาวน์โหลดรายงาน",
            href: `${basePath}/reports`,
            iconKey: "FileBarChart",
          },
        ],
        secondaryLabel: "รายงาน",
      };
    case UserRole.HEAD_FINANCE:
      return {
        menu: buildApprovalFlowMenu(basePath),
        secondaryMenu: [
          {
            label: "ดาวน์โหลดรายงาน",
            href: `${basePath}/reports`,
            iconKey: "FileBarChart",
          },
        ],
        secondaryLabel: "รายงาน",
      };
    case UserRole.DIRECTOR:
      return {
        menu: buildApprovalFlowMenu(basePath),
        secondaryMenu: [
          {
            label: "รายงานกำหนดเวลาอนุมัติ",
            href: `${basePath}/sla-report`,
            iconKey: "Clock",
          },
          {
            label: "ดาวน์โหลดรายงาน",
            href: `${basePath}/reports`,
            iconKey: "FileBarChart",
          },
        ],
        secondaryLabel: "รายงาน",
      };
    case UserRole.PTS_OFFICER:
      return {
        menu: [
          { label: "แดชบอร์ด", href: basePath, iconKey: "LayoutDashboard" },
          {
            label: "คำขอรออนุมัติ",
            href: `${basePath}/requests`,
            iconKey: "FileCheck",
            badgeKey: "pendingRequests",
          },
          {
            label: "ประวัติการอนุมัติ",
            href: `${basePath}/history`,
            iconKey: "Clock",
          },
          {
            label: "รายชื่อผู้มีสิทธิ์",
            href: `${basePath}/allowance-list`,
            iconKey: "Users",
          },
          {
            label: "รอบจ่ายเงิน",
            href: `${basePath}/payroll`,
            iconKey: "Calculator",
            badgeKey: "pendingPayroll",
          },
          {
            label: "แจ้งเตือนใบอนุญาต",
            href: `${basePath}/license-compliance`,
            iconKey: "AlertTriangle",
          },
          {
            label: "จัดการวันลา",
            href: `${basePath}/leave-management`,
            iconKey: "CalendarDays",
          },
          {
            label: "การเปลี่ยนแปลงบุคลากร",
            href: `${basePath}/personnel-changes`,
            iconKey: "UserMinus",
          },
        ],
        secondaryMenu: [
          {
            label: "จัดการวันหยุด",
            href: `${basePath}/holidays`,
            iconKey: "Calendar",
          },
          {
            label: "จัดการอัตราเงิน",
            href: `${basePath}/rates`,
            iconKey: "FileText",
          },
        ],
        secondaryLabel: "ข้อมูลหลัก",
      };
    case UserRole.FINANCE_OFFICER:
      return {
        menu: [
          { label: "แดชบอร์ด", href: basePath, iconKey: "LayoutDashboard" },
          {
            label: "การจ่ายเงิน",
            href: `${basePath}/payouts`,
            iconKey: "Wallet",
            badgeKey: "pendingPayroll",
          },
          {
            label: "สรุปรายปี",
            href: `${basePath}/yearly-summary`,
            iconKey: "TrendingUp",
          },
        ],
        secondaryMenu: [
          {
            label: "ดาวน์โหลดรายงาน",
            href: `${basePath}/reports`,
            iconKey: "FileBarChart",
          },
        ],
        secondaryLabel: "รายงาน",
      };
    case UserRole.ADMIN:
      return {
        menu: [
          { label: "แดชบอร์ด", href: basePath, iconKey: "LayoutDashboard" },
          {
            label: "จัดการผู้ใช้",
            href: `${basePath}/users`,
            iconKey: "Users",
          },
          {
            label: "ตรวจสอบสิทธิ์",
            href: `${basePath}/access-review`,
            iconKey: "Shield",
          },
          {
            label: "บันทึกการใช้งาน",
            href: `${basePath}/audit-logs`,
            iconKey: "FileText",
          },
        ],
        secondaryMenu: [
          {
            label: "ตั้งค่าประกาศ",
            href: `${basePath}/announcements`,
            iconKey: "Megaphone",
          },
          {
            label: "ตอบ Ticket",
            href: `${basePath}/support`,
            iconKey: "HelpCircle",
          },
          {
            label: "ตั้งค่า SLA",
            href: `${basePath}/sla-config`,
            iconKey: "ClipboardList",
          },
          { label: "ระบบ", href: `${basePath}/system`, iconKey: "Server" },
        ],
        secondaryLabel: "การจัดการ",
      };
    case UserRole.HEAD_SCOPE:
      return {
        menu: buildHeadScopeMenu(basePath),
        secondaryMenu: [
          {
            label: "คำขอของฉัน",
            href: `${basePath}/my-requests`,
            iconKey: "FileText",
          },
        ],
        secondaryLabel: "งานของฉัน",
      };
    default:
      return { menu: [] };
  }
};
