import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { announcementRepository } from '@/modules/announcement/repositories/announcement.repository.js';
import { requestQueryService } from '@/modules/request/services/query.service.js';
import { RequestStatus, RequestWithDetails } from '@/modules/request/request.types.js';
import type { Announcement } from '@/modules/announcement/entities/announcement.entity.js';

export type UserDashboardStats = {
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

export type UserDashboardRecentRequest = {
  request_id: number;
  display_id: string;
  month_label: string;
  amount: string;
  status: RequestStatus;
  status_label: string;
  step: number;
  submitted_label: string;
};

export type UserDashboardAnnouncement = {
  id: number;
  title: string;
  date: string;
  priority: 'high' | 'normal' | 'low';
};

export type UserDashboardPayload = {
  stats: UserDashboardStats;
  recent_requests: UserDashboardRecentRequest[];
  announcements: UserDashboardAnnouncement[];
};

const isPendingStatus = (status: RequestStatus) => status.startsWith('PENDING');

const getPendingStepLabel = (step?: number | null) => {
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
      return 'รอดำเนินการ';
  }
};

const getStatusLabel = (status: RequestStatus, step?: number | null) => {
  if (isPendingStatus(status)) return getPendingStepLabel(step);
  switch (status) {
    case 'APPROVED':
      return 'อนุมัติแล้ว';
    case 'REJECTED':
      return 'ไม่อนุมัติ';
    case 'RETURNED':
      return 'ส่งกลับแก้ไข';
    case 'CANCELLED':
      return 'ยกเลิก';
    case 'DRAFT':
      return 'ฉบับร่าง';
    default:
      return status;
  }
};

const formatThaiMonthYear = (value?: string | Date | null) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
};

const formatRelativeDays = (value?: string | Date | null) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'วันนี้';
  if (diffDays === 1) return 'เมื่อวาน';
  return `${diffDays} วันที่แล้ว`;
};

const formatThaiDate = (value?: string | Date | null) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
};

const mapPriority = (priority?: string | null): 'high' | 'normal' | 'low' => {
  switch ((priority ?? '').toUpperCase()) {
    case 'HIGH':
      return 'high';
    case 'LOW':
      return 'low';
    default:
      return 'normal';
  }
};

const getPrimaryDate = (request: RequestWithDetails) =>
  request.created_at || request.updated_at || request.effective_date || '';

const buildDisplayId = (requestId: number, createdAt?: string | Date | null) => {
  const createdDate = createdAt ? new Date(createdAt) : new Date();
  const beYear = createdDate.getFullYear() + 543;
  const seq = String(Math.abs(Math.trunc(requestId))).padStart(4, '0');
  return `REQ-${beYear}-${seq}`;
};

export const buildUserDashboard = (params: {
  requests: RequestWithDetails[];
  unreadCount: number;
  unreadToday: number;
  announcements: Announcement[];
}): UserDashboardPayload => {
  const { requests, unreadCount, unreadToday, announcements } = params;
  const pendingSteps = Array.from(
    new Set(
      requests
        .filter((req) => isPendingStatus(req.status))
        .map((req) => Number(req.current_step || 0))
        .filter((step) => step > 0),
    ),
  ).sort((a, b) => a - b);

  const pendingCount = requests.filter((req) => isPendingStatus(req.status)).length;
  const approvedCount = requests.filter((req) => req.status === 'APPROVED').length;
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const totalThisMonth = requests.filter((request) => {
    const created = request.created_at ? new Date(request.created_at) : null;
    if (!created || Number.isNaN(created.getTime())) return false;
    return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
  }).length;
  const totalTrend = `${totalThisMonth > 0 ? '+' : ''}${totalThisMonth} เดือนนี้`;
  const pendingTrend = pendingSteps.length > 0
    ? pendingSteps.map((step) => `Step ${step}`).join(', ')
    : undefined;
  const approvedTrend = `อนุมัติแล้ว ${approvedCount} รายการ`;
  const unreadTrend = `วันนี้ ${unreadToday} รายการ`;

  const recentRequests = [...requests]
    .sort((a, b) => new Date(getPrimaryDate(b)).getTime() - new Date(getPrimaryDate(a)).getTime())
    .slice(0, 3)
    .map((request) => ({
      request_id: request.request_id,
      display_id: buildDisplayId(request.request_id, request.created_at),
      month_label: formatThaiMonthYear(request.effective_date),
      amount: request.requested_amount
        ? Number(request.requested_amount).toLocaleString('th-TH')
        : '-',
      status: request.status,
      status_label: getStatusLabel(request.status, request.current_step),
      step: request.current_step || 0,
      submitted_label: formatRelativeDays(request.created_at),
    }));

  const announcementItems = [...announcements]
    .sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime())
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      date: formatThaiDate(item.created_at ?? null),
      priority: mapPriority(item.priority),
    }));

  return {
    stats: {
      total: requests.length,
      pending: pendingCount,
      approved: approvedCount,
      unread: unreadCount,
      pending_steps: pendingSteps,
      total_trend: totalTrend,
      total_trend_up: totalThisMonth > 0,
      pending_trend: pendingTrend,
      pending_trend_up: false,
      approved_trend: approvedTrend,
      approved_trend_up: approvedCount > 0,
      unread_trend: unreadTrend,
      unread_trend_up: false,
    },
    recent_requests: recentRequests,
    announcements: announcementItems,
  };
};

export const getUserDashboard = async (userId: number, role: string) => {
  const [requests, unreadCount, unreadToday, announcements] = await Promise.all([
    requestQueryService.getMyRequests(userId),
    NotificationService.getUnreadCount(userId),
    NotificationService.getUnreadCountToday(userId),
    announcementRepository.listActiveByRole(role),
  ]);

  return buildUserDashboard({ requests, unreadCount, unreadToday, announcements });
};
