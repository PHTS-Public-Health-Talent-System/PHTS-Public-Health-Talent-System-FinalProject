import { UserRole } from '@/types/auth.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { requestQueryService } from '@/modules/request/services/query.service.js';
import { PayrollRepository } from '@/modules/payroll/repositories/payroll.repository.js';
import { PeriodStatus } from '@/modules/payroll/entities/payroll.entity.js';
import { AuthRepository } from '@/modules/auth/repositories/auth.repository.js';
import { FinanceRepository } from '@/modules/finance/repositories/finance.repository.js';
import type { RequestWithDetails } from '@/modules/request/request.types.js';

export type NavigationBadgeKey =
  | 'notifications'
  | 'pendingRequests'
  | 'pendingPayroll';

export type NavigationItem = {
  label: string;
  href: string;
  iconKey: string;
  badgeKey?: NavigationBadgeKey;
};

export type NavigationPayload = {
  user: {
    id: number;
    role: UserRole;
    name: string;
    title: string;
  };
  badges: Record<NavigationBadgeKey, number>;
  menu: NavigationItem[];
  secondaryMenu?: NavigationItem[];
  secondaryLabel?: string;
};

const isPendingStatus = (status?: string | null) => Boolean(status && status.startsWith('PENDING'));

const countPendingForUser = (requests: RequestWithDetails[]) =>
  requests.filter((req) => isPendingStatus(req.status)).length;

const roleBasePath: Record<UserRole, string> = {
  [UserRole.USER]: '/user',
  [UserRole.HEAD_WARD]: '/head-ward',
  [UserRole.HEAD_DEPT]: '/head-dept',
  [UserRole.PTS_OFFICER]: '/pts-officer',
  [UserRole.HEAD_HR]: '/head-hr',
  [UserRole.HEAD_FINANCE]: '/head-finance',
  [UserRole.FINANCE_OFFICER]: '/finance-officer',
  [UserRole.DIRECTOR]: '/director',
  [UserRole.ADMIN]: '/admin',
};

const buildMenu = (role: UserRole): {
  menu: NavigationItem[];
  secondaryMenu?: NavigationItem[];
  secondaryLabel?: string;
} => {
  const basePath = roleBasePath[role];

  switch (role) {
    case UserRole.USER:
      return {
        menu: [
          { label: 'แดชบอร์ด', href: basePath, iconKey: 'LayoutDashboard' },
          { label: 'คำขอของฉัน', href: `${basePath}/my-requests`, iconKey: 'FileText', badgeKey: 'pendingRequests' },
        ],
        secondaryMenu: [
          { label: 'โปรไฟล์', href: `${basePath}/profile`, iconKey: 'User' },
        ],
        secondaryLabel: 'บัญชีผู้ใช้',
      };
    case UserRole.HEAD_HR:
      return {
        menu: [
          { label: 'แดชบอร์ด', href: basePath, iconKey: 'LayoutDashboard' },
          { label: 'คำขอรออนุมัติ', href: `${basePath}/requests`, iconKey: 'FileCheck', badgeKey: 'pendingRequests' },
          { label: 'รอบจ่ายเงิน', href: `${basePath}/payroll`, iconKey: 'Calculator', badgeKey: 'pendingPayroll' },
          { label: 'ประวัติการอนุมัติ', href: `${basePath}/history`, iconKey: 'Clock' },
        ],
        secondaryMenu: [
          { label: 'รายงาน SLA', href: `${basePath}/sla-report`, iconKey: 'ClipboardList' },
          { label: 'ดาวน์โหลดรายงาน', href: `${basePath}/reports`, iconKey: 'FileBarChart' },
        ],
        secondaryLabel: 'รายงาน',
      };
    case UserRole.DIRECTOR:
      return {
        menu: [
          { label: 'แดชบอร์ด', href: basePath, iconKey: 'LayoutDashboard' },
          { label: 'คำขอรออนุมัติ', href: `${basePath}/requests`, iconKey: 'FileCheck', badgeKey: 'pendingRequests' },
          { label: 'รอบจ่ายเงิน', href: `${basePath}/payroll`, iconKey: 'Calculator', badgeKey: 'pendingPayroll' },
          { label: 'ประวัติการอนุมัติ', href: `${basePath}/history`, iconKey: 'Clock' },
        ],
        secondaryMenu: [
          { label: 'รายงาน SLA', href: `${basePath}/sla-report`, iconKey: 'Clock' },
          { label: 'ดาวน์โหลดรายงาน', href: `${basePath}/reports`, iconKey: 'FileBarChart' },
        ],
        secondaryLabel: 'รายงาน',
      };
    case UserRole.PTS_OFFICER:
      return {
        menu: [
          { label: 'แดชบอร์ด', href: basePath, iconKey: 'LayoutDashboard' },
          { label: 'คำขอรออนุมัติ', href: `${basePath}/requests`, iconKey: 'FileCheck', badgeKey: 'pendingRequests' },
          { label: 'ประวัติการอนุมัติ', href: `${basePath}/history`, iconKey: 'Clock' },
          { label: 'รายชื่อผู้มีสิทธิ์', href: `${basePath}/allowance-list`, iconKey: 'Users' },
          { label: 'รอบจ่ายเงิน', href: `${basePath}/payroll`, iconKey: 'Calculator', badgeKey: 'pendingPayroll' },
          { label: 'แจ้งเตือนใบอนุญาต', href: `${basePath}/alerts`, iconKey: 'AlertTriangle' },
          { label: 'จัดการวันลา', href: `${basePath}/leave-management`, iconKey: 'CalendarDays' },
          { label: 'การเปลี่ยนแปลงบุคลากร', href: `${basePath}/personnel-changes`, iconKey: 'UserMinus' },
        ],
        secondaryMenu: [
          { label: 'จัดการวันหยุด', href: `${basePath}/holidays`, iconKey: 'Calendar' },
          { label: 'จัดการอัตราเงิน', href: `${basePath}/rates`, iconKey: 'FileText' },
        ],
        secondaryLabel: 'ข้อมูลหลัก',
      };
    case UserRole.FINANCE_OFFICER:
      return {
        menu: [
          { label: 'แดชบอร์ด', href: basePath, iconKey: 'LayoutDashboard' },
          { label: 'การจ่ายเงิน', href: `${basePath}/payouts`, iconKey: 'Wallet', badgeKey: 'pendingPayroll' },
          { label: 'สรุปรายปี', href: `${basePath}/yearly-summary`, iconKey: 'TrendingUp' },
        ],
        secondaryMenu: [
          { label: 'ดาวน์โหลดรายงาน', href: `${basePath}/reports`, iconKey: 'FileBarChart' },
        ],
        secondaryLabel: 'รายงาน',
      };
    case UserRole.ADMIN:
      return {
        menu: [
          { label: 'แดชบอร์ด', href: basePath, iconKey: 'LayoutDashboard' },
          { label: 'จัดการผู้ใช้', href: `${basePath}/users`, iconKey: 'Users' },
          { label: 'ตรวจสอบสิทธิ์', href: `${basePath}/access-review`, iconKey: 'Shield' },
          { label: 'บันทึกการใช้งาน', href: `${basePath}/audit-logs`, iconKey: 'FileText' },
        ],
        secondaryMenu: [
          { label: 'ตั้งค่าประกาศ', href: `${basePath}/announcements`, iconKey: 'Megaphone' },
          { label: 'ตอบ Ticket', href: `${basePath}/support`, iconKey: 'HelpCircle' },
          { label: 'ตั้งค่า SLA', href: `${basePath}/sla-config`, iconKey: 'ClipboardList' },
          { label: 'ระบบ', href: `${basePath}/system`, iconKey: 'Server' },
        ],
        secondaryLabel: 'การจัดการ',
      };
    case UserRole.HEAD_FINANCE:
      return {
        menu: [
          { label: 'แดชบอร์ด', href: basePath, iconKey: 'LayoutDashboard' },
          { label: 'คำขอรออนุมัติ', href: `${basePath}/requests`, iconKey: 'FileCheck', badgeKey: 'pendingRequests' },
          { label: 'รอบจ่ายเงิน', href: `${basePath}/payroll`, iconKey: 'Calculator', badgeKey: 'pendingPayroll' },
          { label: 'ประวัติการอนุมัติ', href: `${basePath}/history`, iconKey: 'Clock' },
        ],
        secondaryMenu: [
          { label: 'ดาวน์โหลดรายงาน', href: `${basePath}/reports`, iconKey: 'FileBarChart' },
        ],
        secondaryLabel: 'รายงาน',
      };
    case UserRole.HEAD_WARD:
      return {
        menu: [
          { label: 'แดชบอร์ด', href: basePath, iconKey: 'LayoutDashboard' },
          { label: 'คำขอรออนุมัติ', href: `${basePath}/requests`, iconKey: 'FileCheck', badgeKey: 'pendingRequests' },
          { label: 'ขอบเขตที่ดูแล', href: `${basePath}/scopes`, iconKey: 'Users' },
          { label: 'ประวัติการอนุมัติ', href: `${basePath}/history`, iconKey: 'Clock' },
        ],
        secondaryMenu: [
          { label: 'คำขอของฉัน', href: `${basePath}/my-requests`, iconKey: 'FileText' },
        ],
        secondaryLabel: 'งานของฉัน',
      };
    case UserRole.HEAD_DEPT:
      return {
        menu: [
          { label: 'แดชบอร์ด', href: basePath, iconKey: 'LayoutDashboard' },
          { label: 'คำขอรออนุมัติ', href: `${basePath}/requests`, iconKey: 'FileCheck', badgeKey: 'pendingRequests' },
          { label: 'ขอบเขตที่ดูแล', href: `${basePath}/scopes`, iconKey: 'Users' },
          { label: 'ประวัติการอนุมัติ', href: `${basePath}/history`, iconKey: 'Clock' },
        ],
        secondaryMenu: [
          { label: 'คำขอของฉัน', href: `${basePath}/my-requests`, iconKey: 'FileText' },
        ],
        secondaryLabel: 'งานของฉัน',
      };
    default:
      return { menu: [] };
  }
};

const resolvePayrollStatus = (role: UserRole): PeriodStatus | null => {
  switch (role) {
    case UserRole.HEAD_HR:
      return PeriodStatus.WAITING_HR;
    case UserRole.HEAD_FINANCE:
      return PeriodStatus.WAITING_HEAD_FINANCE;
    case UserRole.DIRECTOR:
      return PeriodStatus.WAITING_DIRECTOR;
    case UserRole.PTS_OFFICER:
      return PeriodStatus.OPEN;
    case UserRole.FINANCE_OFFICER:
      return PeriodStatus.WAITING_HEAD_FINANCE;
    default:
      return null;
  }
};

export const getNavigationPayload = async (params: {
  userId: number;
  citizenId: string;
  role: UserRole;
}): Promise<NavigationPayload> => {
  const { userId, citizenId, role } = params;

  const [unreadCount, profile] = await Promise.all([
    NotificationService.getUnreadCount(userId),
    AuthRepository.findEmployeeProfileByCitizenId(citizenId),
  ]);

  let pendingRequests = 0;
  if (role === UserRole.USER) {
    const myRequests = await requestQueryService.getMyRequests(userId);
    pendingRequests = countPendingForUser(myRequests);
  } else if (
    role === UserRole.HEAD_WARD ||
    role === UserRole.HEAD_DEPT ||
    role === UserRole.PTS_OFFICER ||
    role === UserRole.HEAD_HR ||
    role === UserRole.HEAD_FINANCE ||
    role === UserRole.DIRECTOR
  ) {
    const pendingForApprover = await requestQueryService.getPendingForApprover(role, userId);
    pendingRequests = pendingForApprover.length;
  }

  let pendingPayroll = 0;
  if (role === UserRole.FINANCE_OFFICER) {
    const financeSummary = await FinanceRepository.findFinanceSummary(undefined, undefined, true);
    pendingPayroll = financeSummary.filter((period) => {
      const pendingCount = Number(period.pending_count ?? 0);
      const pendingAmount = Number(period.pending_amount ?? 0);
      return pendingCount > 0 || pendingAmount > 0;
    }).length;
  } else {
    const payrollStatus = resolvePayrollStatus(role);
    if (payrollStatus) {
      const periods = await PayrollRepository.findPeriodsByStatus(payrollStatus, 50);
      pendingPayroll = periods.length;
    }
  }

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  const title = profile?.position ?? '';

  const menuConfig = buildMenu(role);

  return {
    user: {
      id: userId,
      role,
      name: name || 'ผู้ใช้งาน',
      title: title || 'ผู้ใช้งาน',
    },
    badges: {
      notifications: unreadCount ?? 0,
      pendingRequests: pendingRequests ?? 0,
      pendingPayroll: pendingPayroll ?? 0,
    },
    menu: menuConfig.menu,
    secondaryMenu: menuConfig.secondaryMenu,
    secondaryLabel: menuConfig.secondaryLabel,
  };
};
