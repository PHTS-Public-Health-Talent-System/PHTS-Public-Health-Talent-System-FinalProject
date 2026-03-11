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

const getPendingStepLabel = (step: number): string => {
  switch (step) {
    case 1:
      return 'รอหัวหน้าตึก/หัวหน้างาน';
    case 2:
      return 'รอหัวหน้ากลุ่มงาน';
    case 3:
      return 'รอเจ้าหน้าที่ พ.ต.ส.';
    case 4:
      return 'รอหัวหน้ากลุ่มงานทรัพยากรบุคคล';
    case 5:
      return 'รอหัวหน้าการเงิน';
    case 6:
      return 'รอผู้อำนวยการ';
    default:
      return `รอขั้นตอนที่ ${step}`;
  }
};

const formatPendingStepsTrend = (steps: number[]): string | undefined => {
  if (steps.length === 0) return undefined;
  const labels = steps.map((step) => getPendingStepLabel(step));
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} และอีก ${labels.length - 2} ขั้นตอน`;
};

const normalizePendingTrend = (
  pendingTrend: string | undefined,
  pendingSteps: number[],
): string | undefined => {
  const raw = pendingTrend?.trim();
  if (!raw) return formatPendingStepsTrend(pendingSteps);

  // Convert legacy backend format like "Step 1, Step 3, Step 4" to Thai labels.
  const matched = [...raw.matchAll(/Step\s*(\d+)/gi)];
  if (matched.length > 0) {
    const parsedSteps = matched
      .map((m) => Number(m[1]))
      .filter((s) => Number.isFinite(s) && s > 0);
    if (parsedSteps.length > 0) return formatPendingStepsTrend(parsedSteps);
  }

  return raw;
};

export const buildStatItems = (stats: DashboardStatsPayload, icons: DashboardIcons): StatItem[] => {
  const pendingTrend = normalizePendingTrend(stats.pending_trend, stats.pending_steps);

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
