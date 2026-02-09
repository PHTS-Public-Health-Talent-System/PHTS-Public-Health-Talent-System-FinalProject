import api from '@/shared/api/axios';
import type { ApiResponse } from '@/shared/api/types';
import type { RequestStatus } from '@/types/request.types';

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

export type HeadHrDashboardStats = {
  pending_requests: number;
  pending_payrolls: number;
  approved_month: number;
  sla_overdue: number;
};

export type HeadHrPendingRequest = {
  id: string;
  name: string;
  position: string;
  department: string;
  amount: number;
  date: string;
  sla_status: 'normal' | 'warning' | 'danger' | 'overdue';
};

export type HeadHrPendingPayroll = {
  id: string;
  month: string;
  totalAmount: number;
  totalPersons: number;
  submittedAt: string;
};

export type HeadHrDashboardPayload = {
  stats: HeadHrDashboardStats;
  pending_requests: HeadHrPendingRequest[];
  pending_payrolls: HeadHrPendingPayroll[];
};

export async function getUserDashboard() {
  const res = await api.get<ApiResponse<UserDashboardPayload>>('/dashboard/user');
  return res.data.data;
}

export async function getHeadHrDashboard() {
  const res = await api.get<ApiResponse<HeadHrDashboardPayload>>('/dashboard/head-hr');
  return res.data.data;
}
