import type { RequestWithDetails, RequestStatus } from '@/types/request.types';
import type { Announcement } from '@/features/announcement/api';
import type { StatusType } from '@/components/status-badge';
import { toRequestDisplayId } from '@/shared/utils/public-id';
import {
  formatThaiDate,
  formatThaiMonthYear,
  formatThaiNumber,
} from '@/shared/utils/thai-locale';

export type DashboardGreetingUser = {
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type DashboardStats = {
  total: { value: string };
  pending: { value: string; steps: number[] };
  approved: { value: string };
  unread: { value: string };
};

export type RecentRequest = {
  id: string;
  requestId: number;
  month: string;
  amount: string;
  status: StatusType;
  statusLabel: string;
  step: number;
  submittedAt: string;
};

export type DashboardAnnouncement = {
  id: number;
  title: string;
  date: string;
  priority: 'high' | 'normal' | 'low';
};

const resolveName = (user?: DashboardGreetingUser) => {
  const first = user?.first_name ?? user?.firstName ?? '';
  const last = user?.last_name ?? user?.lastName ?? '';
  return `${first} ${last}`.trim();
};

export const buildGreeting = (user?: DashboardGreetingUser) => {
  const name = resolveName(user);
  return `ยินดีต้อนรับ ${name || 'ผู้ใช้งาน'} - ติดตามคำขอและรับเงิน พ.ต.ส. ของคุณ`;
};

const isPendingStatus = (status: RequestStatus) => status.startsWith('PENDING');

export const buildStats = (requests: RequestWithDetails[], unreadCount: number): DashboardStats => {
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

  return {
    total: { value: String(requests.length) },
    pending: { value: String(pendingCount), steps: pendingSteps },
    approved: { value: String(approvedCount) },
    unread: { value: String(unreadCount) },
  };
};

const mapStatusToType = (status: RequestStatus): StatusType => {
  switch (status) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'RETURNED':
      return 'returned';
    case 'CANCELLED':
      return 'cancelled';
    case 'DRAFT':
      return 'draft';
    default:
      return 'pending';
  }
};

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

const formatThaiMonthYearByDate = (dateString?: string | null) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return formatThaiMonthYear(date.getMonth() + 1, date.getFullYear());
};

const formatRelativeDays = (dateString?: string | null) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'วันนี้';
  if (diffDays === 1) return 'เมื่อวาน';
  return `${diffDays} วันที่แล้ว`;
};

const getPrimaryDate = (request: RequestWithDetails) =>
  request.created_at || request.updated_at || request.effective_date || '';

export const buildRecentRequests = (requests: RequestWithDetails[]): RecentRequest[] => {
  return [...requests]
    .sort((a, b) => new Date(getPrimaryDate(b)).getTime() - new Date(getPrimaryDate(a)).getTime())
    .slice(0, 3)
    .map((request) => ({
      id: request.request_no ?? toRequestDisplayId(request.request_id, request.created_at),
      requestId: request.request_id,
      month: formatThaiMonthYearByDate(request.effective_date),
      amount: request.requested_amount
        ? formatThaiNumber(request.requested_amount)
        : '-',
      status: mapStatusToType(request.status),
      statusLabel: getStatusLabel(request.status, request.current_step),
      step: request.current_step || 0,
      submittedAt: formatRelativeDays(request.created_at),
    }));
};

const mapPriority = (priority?: string | null) => {
  switch ((priority ?? '').toUpperCase()) {
    case 'HIGH':
      return 'high';
    case 'LOW':
      return 'low';
    default:
      return 'normal';
  }
};

export const buildAnnouncements = (announcements: Announcement[]): DashboardAnnouncement[] => {
  return [...announcements]
    .sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime())
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      date: formatThaiDate(item.created_at ?? null),
      priority: mapPriority(item.priority),
    }));
};
