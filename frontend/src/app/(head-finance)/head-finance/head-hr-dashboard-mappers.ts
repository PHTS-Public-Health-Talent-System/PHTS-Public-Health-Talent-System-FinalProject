import type { StatItem } from '@/components/stat-cards';

export type HeadFinanceDashboardStats = {
  pending_requests: number;
  pending_payrolls: number;
  approved_month: number;
  sla_overdue: number;
};

export type HeadFinanceDashboardIcons = {
  FileCheck: StatItem['icon'];
  Calculator: StatItem['icon'];
  CheckCircle2: StatItem['icon'];
  AlertTriangle: StatItem['icon'];
};

export const buildHeadFinanceStatItems = (
  stats: HeadFinanceDashboardStats,
  icons: HeadFinanceDashboardIcons,
): StatItem[] => [
  {
    title: 'คำขอรออนุมัติ',
    value: String(stats.pending_requests),
    description: 'รอการตรวจสอบ',
    icon: icons.FileCheck,
    href: '/head-finance/requests',
  },
  {
    title: 'รอบจ่ายรออนุมัติ',
    value: String(stats.pending_payrolls),
    description: 'รอ HR อนุมัติ',
    icon: icons.Calculator,
    href: '/head-finance/payroll',
  },
  {
    title: 'อนุมัติแล้วเดือนนี้',
    value: String(stats.approved_month),
    description: 'คำขอที่ผ่านการอนุมัติ',
    icon: icons.CheckCircle2,
    href: '/head-finance/requests',
  },
  {
    title: 'SLA เกินกำหนด',
    value: String(stats.sla_overdue),
    description: 'ต้องเร่งดำเนินการ',
    icon: icons.AlertTriangle,
    href: '/head-finance/sla-report',
  },
];
