import type { StatItem } from '@/components/stat-cards';

export type DashboardStatsPayload = {
  total: number;
  pending: number;
  approved: number;
  unread: number;
  pending_steps: number[];
  total_trend: string;
  total_trend_up: boolean;
  pending_trend?: string;
  pending_trend_up?: boolean;
  approved_trend: string;
  approved_trend_up: boolean;
  unread_trend: string;
  unread_trend_up: boolean;
};

export type DashboardIcons = {
  FileText: StatItem['icon'];
  Clock: StatItem['icon'];
  CheckCircle2: StatItem['icon'];
  Bell: StatItem['icon'];
};

export const buildStatItems = (stats: DashboardStatsPayload, icons: DashboardIcons): StatItem[] => {
  const pendingTrend = stats.pending_trend ?? (stats.pending_steps.length > 0
    ? stats.pending_steps.map((step) => `Step ${step}`).join(', ')
    : undefined);

  return [
    {
      title: 'คำขอทั้งหมด',
      value: String(stats.total),
      description: 'ทั้งหมดตลอดเวลา',
      icon: icons.FileText,
      href: '/user/my-requests',
      trend: stats.total_trend,
      trendUp: stats.total_trend_up,
    },
    {
      title: 'รอดำเนินการ',
      value: String(stats.pending),
      description: 'รอการอนุมัติ',
      icon: icons.Clock,
      href: '/user/my-requests?status=pending',
      trend: pendingTrend,
      trendUp: stats.pending_trend_up ?? false,
    },
    {
      title: 'อนุมัติแล้ว',
      value: String(stats.approved),
      description: 'ทั้งหมดตลอดเวลา',
      icon: icons.CheckCircle2,
      href: '/user/my-requests?status=approved',
      trend: stats.approved_trend,
      trendUp: stats.approved_trend_up,
    },
    {
      title: 'แจ้งเตือนใหม่',
      value: String(stats.unread),
      description: 'ยังไม่ได้อ่าน',
      icon: icons.Bell,
      href: '/user/notifications',
      trend: stats.unread_trend,
      trendUp: stats.unread_trend_up,
    },
  ];
};
