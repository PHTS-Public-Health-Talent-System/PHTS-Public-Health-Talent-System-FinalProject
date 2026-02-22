/**
 * dashboard module - business logic
 *
 */
import { requestQueryService } from "@/modules/request/read/services/query.service.js";
import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository.js";
import { PayPeriod } from "@/modules/payroll/entities/payroll.entity.js";
import { UserRole } from "@/types/auth.js";
import {
  getSLAReport,
  getPendingRequestsWithSLA,
} from "@/modules/sla/services/sla.service.js";
import type { RequestWithDetails } from "@/modules/request/contracts/request.types.js";
import type { RequestSLAInfo } from "@/modules/sla/entities/sla.entity.js";
import {
  getPendingPayrollCount,
  getPendingPayrollStatusForApprover,
} from "@/modules/dashboard/services/counters.service.js";
import { DashboardRepository } from "@/modules/dashboard/repositories/dashboard.repository.js";

export type ApproverDashboardStats = {
  pending_requests: number;
  pending_payrolls: number;
  approved_month: number;
  sla_overdue: number;
};

export type ApproverPendingRequest = {
  id: string;
  name: string;
  position: string;
  department: string;
  amount: number;
  date: string;
  sla_status: "normal" | "warning" | "danger" | "overdue";
};

export type ApproverPendingPayroll = {
  id: string;
  month: string;
  totalAmount: number;
  totalPersons: number;
  submittedAt: string;
};

export type ApproverDashboardPayload = {
  stats: ApproverDashboardStats;
  pending_requests: ApproverPendingRequest[];
  pending_payrolls: ApproverPendingPayroll[];
};

const parseSubmission = (value: RequestWithDetails["submission_data"]) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
};

const formatThaiDate = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
};

const formatThaiMonthYear = (month: number, year: number) => {
  const normalizedYear = year >= 2400 ? year - 543 : year;
  const date = new Date(normalizedYear, month - 1, 1);
  return date.toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
};

const getRequestDisplayId = (request: RequestWithDetails) =>
  request.request_no || `REQ-${request.request_id}`;

const mapSlaStatus = (
  info?: Pick<
    RequestSLAInfo,
    "is_overdue" | "is_approaching_sla" | "days_until_sla"
  >,
) => {
  if (!info) return "normal";
  if (info.is_overdue) return "overdue";
  if (info.is_approaching_sla) return "warning";
  if (info.days_until_sla <= 1) return "danger";
  return "normal";
};

export const buildApproverDashboard = (params: {
  pendingRequests: RequestWithDetails[];
  slaInfoByRequest: Map<
    number,
    { status: "normal" | "warning" | "danger" | "overdue" }
  >;
  pendingPayrolls: PayPeriod[];
  approvedMonthCount: number;
  slaOverdueCount: number;
}): ApproverDashboardPayload => {
  const {
    pendingRequests,
    slaInfoByRequest,
    pendingPayrolls,
    approvedMonthCount,
    slaOverdueCount,
  } = params;

  const pendingItems = pendingRequests.slice(0, 4).map((request) => {
    const submission = parseSubmission(request.submission_data) as {
      first_name?: string;
      last_name?: string;
      position_name?: string;
      department?: string;
      sub_department?: string;
    };
    const name =
      `${submission.first_name ?? ""} ${submission.last_name ?? ""}`.trim() ||
      "-";
    const position = submission.position_name ?? "-";
    const department =
      submission.sub_department ?? submission.department ?? "-";
    const sla = slaInfoByRequest.get(request.request_id);

    return {
      id: getRequestDisplayId(request),
      name,
      position,
      department,
      amount: request.requested_amount ?? 0,
      date: formatThaiDate(request.created_at),
      sla_status: sla?.status ?? "normal",
    };
  });

  const payrollItems = pendingPayrolls.slice(0, 4).map((period) => ({
    id: `PAY-${period.period_year}-${String(period.period_month).padStart(2, "0")}`,
    month: formatThaiMonthYear(period.period_month, period.period_year),
    totalAmount: Number(period.total_amount ?? 0),
    totalPersons: Number(period.total_headcount ?? 0),
    submittedAt: formatThaiDate(period.updated_at),
  }));

  return {
    stats: {
      pending_requests: pendingRequests.length,
      pending_payrolls: pendingPayrolls.length,
      approved_month: approvedMonthCount,
      sla_overdue: slaOverdueCount,
    },
    pending_requests: pendingItems,
    pending_payrolls: payrollItems,
  };
};

const resolveApproverRole = (role: UserRole): UserRole => {
  if (role === UserRole.HEAD_FINANCE) return UserRole.HEAD_FINANCE;
  return UserRole.HEAD_HR;
};

export const getApproverDashboard = async (userId: number, role: UserRole) => {
  const approverRole = resolveApproverRole(role);
  const pendingPayrollStatus = getPendingPayrollStatusForApprover(approverRole);
  const [pendingRequests, pendingPayrolls, pendingPayrollCount, slaReport, slaPending] =
    await Promise.all([
      requestQueryService.getPendingForApprover(approverRole, userId),
      PayrollRepository.findPeriodsByStatus(pendingPayrollStatus, 4),
      getPendingPayrollCount(approverRole),
      getSLAReport(),
      getPendingRequestsWithSLA(),
    ]);

  const slaInfoByRequest = new Map<
    number,
    { status: "normal" | "warning" | "danger" | "overdue" }
  >();
  slaPending.forEach((info) => {
    slaInfoByRequest.set(info.request_id, {
      status: mapSlaStatus(info),
    });
  });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const approvedMonthCount = await DashboardRepository.countApprovedRequestsByMonth({
    month,
    year,
  });

  const payload = buildApproverDashboard({
    pendingRequests,
    slaInfoByRequest,
    pendingPayrolls,
    approvedMonthCount,
    slaOverdueCount: slaReport.overdueSLA,
  });
  return {
    ...payload,
    stats: {
      ...payload.stats,
      pending_payrolls: pendingPayrollCount,
    },
  };
};
