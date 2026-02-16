/**
 * PHTS System - SLA Service Facade
 *
 * Service layer for SLA tracking and management
 */

import { SLARepository } from '@/modules/sla/repositories/sla.repository.js';
import {
  SLAConfig,
  SLAKpiAgingBucket,
  SLAKpiErrorByStepRow,
  SLAKpiErrorOverview,
  SLAKpiByStepRow,
  SLAKpiErrorCategoryRow,
  SLAKpiDataQuality,
  SLAKpiOverview,
  SLAReport,
  SLAReminderResult,
  RequestSLAInfo,
} from '@/modules/sla/entities/sla.entity.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { STEP_ROLE_MAP } from '@shared/policy/request.policy.js';

// ─── SLA Config Functions ─────────────────────────────────────────────────────

export async function getSLAConfigs(): Promise<SLAConfig[]> {
  return SLARepository.findAllConfigs();
}

export async function updateSLAConfig(
  stepNo: number,
  slaDays: number,
  reminderBeforeDays?: number,
  reminderAfterDays?: number,
): Promise<void> {
  const config = await SLARepository.findConfigByStep(stepNo);
  if (!config) {
    throw new Error(`SLA config not found for step ${stepNo}`);
  }
  await SLARepository.updateConfig(
    stepNo,
    slaDays,
    reminderBeforeDays,
    reminderAfterDays,
  );
}

// ─── Business Days Calculation ────────────────────────────────────────────────

export async function calculateBusinessDays(
  startDate: Date,
  endDate: Date,
): Promise<number> {
  const holidays = await SLARepository.findHolidaysInRange(startDate, endDate);

  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split("T")[0];

    // Skip weekends (0=Sunday, 6=Saturday) and holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateStr)) {
      count++;
    }

    current.setDate(current.getDate() + 1);
  }

  return count;
}

// ─── SLA Report ───────────────────────────────────────────────────────────────

export async function getSLAReport(): Promise<SLAReport> {
  const pendingRequests = await SLARepository.findPendingRequestsWithSLA();
  const configs = await SLARepository.findAllConfigs();

  const configMap = new Map(configs.map((c) => [c.step_no, c]));

  let withinSLA = 0;
  let approachingSLA = 0;
  let overdueSLA = 0;

  const stepCounts = new Map<number, { count: number; overdue: number }>();

  for (const req of pendingRequests) {
    const config = configMap.get(req.current_step);
    if (!config) continue;

    const elapsedDays = await calculateBusinessDays(
      new Date(req.step_started_at),
      new Date(),
    );

    const stepStats = stepCounts.get(req.current_step) || {
      count: 0,
      overdue: 0,
    };
    stepStats.count++;

    if (elapsedDays > config.sla_days) {
      overdueSLA++;
      stepStats.overdue++;
    } else if (elapsedDays >= config.sla_days - config.reminder_before_days) {
      approachingSLA++;
    } else {
      withinSLA++;
    }

    stepCounts.set(req.current_step, stepStats);
  }

  const byStep = Array.from(stepCounts.entries()).map(([step, stats]) => ({
    step,
    role: STEP_ROLE_MAP[step] || "UNKNOWN",
    count: stats.count,
    overdue: stats.overdue,
  }));

  return {
    totalPending: pendingRequests.length,
    withinSLA,
    approachingSLA,
    overdueSLA,
    byStep,
  };
}

// ─── Pending Requests with SLA Info ───────────────────────────────────────────

export async function getPendingRequestsWithSLA(params?: {
  startDate?: Date | null;
  endDate?: Date | null;
}): Promise<RequestSLAInfo[]> {
  const pendingRequests = await SLARepository.findPendingRequestsWithSLA({
    startDate: params?.startDate ?? null,
    endDate: params?.endDate ?? null,
  });
  const configs = await SLARepository.findAllConfigs();

  const configMap = new Map(configs.map((c) => [c.step_no, c]));
  const results: RequestSLAInfo[] = [];

  for (const req of pendingRequests) {
    const config = configMap.get(req.current_step);
    if (!config) continue;

    const elapsedDays = await calculateBusinessDays(
      new Date(req.step_started_at),
      new Date(),
    );

    const daysUntilSLA = config.sla_days - elapsedDays;
    const isOverdue = daysUntilSLA < 0;
    const isApproaching =
      !isOverdue && daysUntilSLA <= config.reminder_before_days;

    const role = STEP_ROLE_MAP[req.current_step];
    const approverIds = role ? await SLARepository.findUsersByRole(role) : [];

    results.push({
      request_id: req.request_id,
      request_no: req.request_no,
      citizen_id: req.citizen_id,
      first_name: req.first_name ?? null,
      last_name: req.last_name ?? null,
      current_step: req.current_step,
      step_started_at: req.step_started_at,
      assigned_officer_id: req.assigned_officer_id ?? null,
      business_days_elapsed: elapsedDays,
      sla_days: config.sla_days,
      is_approaching_sla: isApproaching,
      is_overdue: isOverdue,
      days_until_sla: Math.max(0, daysUntilSLA),
      days_overdue: isOverdue ? Math.abs(daysUntilSLA) : 0,
      approver_ids: approverIds,
    });
  }

  return results;
}

type KpiDateRange = { from: Date; to: Date; fromText: string; toText: string };

function resolveDateRange(params?: {
  from?: string;
  to?: string;
}): KpiDateRange {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = params?.from ? new Date(params.from) : defaultFrom;
  const to = params?.to ? new Date(params.to) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range");
  }
  if (from > to) {
    throw new Error("from must be before to");
  }
  return {
    from,
    to,
    fromText: from.toISOString().slice(0, 10),
    toText: to.toISOString().slice(0, 10),
  };
}

function percentile(sorted: number[], ratio: number): number {
  if (!sorted.length) return 0;
  const position = Math.ceil(sorted.length * ratio) - 1;
  const index = Math.max(0, Math.min(sorted.length - 1, position));
  return sorted[index];
}

async function calculateBusinessDaysFast(
  startDate: Date,
  endDate: Date,
  holidays: Set<string>,
): Promise<number> {
  let count = 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) return 0;
  while (start <= end) {
    const day = start.getDay();
    const key = start.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidays.has(key)) {
      count += 1;
    }
    start.setDate(start.getDate() + 1);
  }
  return count;
}

async function buildStepStats(
  from: Date,
  to: Date,
): Promise<{
  stepRows: SLAKpiByStepRow[];
  quality: Pick<SLAKpiDataQuality, "step_missing_enter" | "step_negative_duration">;
}> {
  const approvals = await SLARepository.findApprovalsInRangeForKPI(from, to);
  const configs = await SLARepository.findAllConfigs();
  const configMap = new Map(configs.map((c) => [c.step_no, c]));
  const holidays = await SLARepository.findHolidaysInRange(from, to);

  const durationsByStep = new Map<number, number[]>();
  const totalsByStep = new Map<number, number>();
  const onTimeByStep = new Map<number, number>();
  let stepMissingEnter = 0;
  let stepNegativeDuration = 0;

  const timelineByRequest = new Map<number, any[]>();
  approvals.forEach((row) => {
    const requestId = Number(row.request_id);
    if (!timelineByRequest.has(requestId)) timelineByRequest.set(requestId, []);
    timelineByRequest.get(requestId)!.push(row);
  });

  for (const rows of timelineByRequest.values()) {
    let lastEventTime: Date | null = null;
    for (const row of rows) {
      const action = String(row.action);
      const step = Number(row.step_no);
      const createdAt = new Date(row.created_at);
      if (action === "SUBMIT") {
        lastEventTime = createdAt;
        continue;
      }
      if (!["APPROVE", "REJECT", "RETURN", "CANCEL"].includes(action)) continue;
      if (!lastEventTime) {
        stepMissingEnter += 1;
        lastEventTime = createdAt;
        continue;
      }
      if (createdAt < lastEventTime) {
        stepNegativeDuration += 1;
        lastEventTime = createdAt;
        continue;
      }
      const duration = await calculateBusinessDaysFast(lastEventTime, createdAt, holidays);
      if (!durationsByStep.has(step)) durationsByStep.set(step, []);
      durationsByStep.get(step)!.push(duration);
      totalsByStep.set(step, (totalsByStep.get(step) ?? 0) + 1);
      const slaDays = configMap.get(step)?.sla_days ?? 0;
      if (slaDays > 0 && duration <= slaDays) {
        onTimeByStep.set(step, (onTimeByStep.get(step) ?? 0) + 1);
      }
      lastEventTime = createdAt;
    }
  }

  const stepRows: SLAKpiByStepRow[] = Array.from(configMap.values())
    .sort((a, b) => a.step_no - b.step_no)
    .map((config) => {
      const step = config.step_no;
      const list = [...(durationsByStep.get(step) ?? [])].sort((a, b) => a - b);
      const total = totalsByStep.get(step) ?? 0;
      const median = total > 0 ? percentile(list, 0.5) : 0;
      const p90 = total > 0 ? percentile(list, 0.9) : 0;
      const onTime = onTimeByStep.get(step) ?? 0;
      const onTimeRate = total > 0 ? Math.round((onTime / total) * 100) : 0;
      return {
        step,
        role: config.role_name,
        total,
        median_days: Number(median.toFixed(2)),
        p90_days: Number(p90.toFixed(2)),
        on_time_rate: onTimeRate,
      };
    });

  return {
    stepRows,
    quality: {
      step_missing_enter: stepMissingEnter,
      step_negative_duration: stepNegativeDuration,
    },
  };
}

export async function getSLAKpiOverview(params?: {
  from?: string;
  to?: string;
}): Promise<SLAKpiOverview> {
  const { from, to, fromText, toText } = resolveDateRange(params);
  const closed = await SLARepository.findClosedRequestsForKPI(from, to);
  const pending = await getPendingRequestsWithSLA({ startDate: from, endDate: to });
  const configs = await SLARepository.findAllConfigs();
  const totalSlaDays = configs.reduce((sum, item) => sum + Number(item.sla_days || 0), 0);

  const holidays = await SLARepository.findHolidaysInRange(from, to);
  const leadTimes: number[] = [];
  let onTime = 0;
  let rework = 0;

  const approvals = await SLARepository.findApprovalsInRangeForKPI(from, to);
  const returnedSet = new Set<number>(
    approvals.filter((row) => String(row.action) === "RETURN").map((row) => Number(row.request_id)),
  );

  for (const row of closed) {
    const submittedAt = row.submitted_at ? new Date(row.submitted_at) : null;
    const completedAt = row.completed_at ? new Date(row.completed_at) : null;
    if (!submittedAt || !completedAt) continue;
    const duration = await calculateBusinessDaysFast(submittedAt, completedAt, holidays);
    leadTimes.push(duration);
    if (duration <= totalSlaDays) onTime += 1;
    if (returnedSet.has(Number(row.request_id))) rework += 1;
  }

  const sortedLeads = [...leadTimes].sort((a, b) => a - b);
  const totalClosed = leadTimes.length;
  const medianLead = totalClosed > 0 ? percentile(sortedLeads, 0.5) : 0;

  return {
    from: fromText,
    to: toText,
    total_closed: totalClosed,
    on_time_completion_rate: totalClosed > 0 ? Math.round((onTime / totalClosed) * 100) : 0,
    median_lead_time_days: Number(medianLead.toFixed(2)),
    throughput_closed: totalClosed,
    rework_rate: totalClosed > 0 ? Math.round((rework / totalClosed) * 100) : 0,
    overdue_backlog_count: pending.filter((item) => item.is_overdue).length,
  };
}

export async function getSLAKpiByStep(params?: {
  from?: string;
  to?: string;
}): Promise<{ from: string; to: string; rows: SLAKpiByStepRow[] }> {
  const { from, to, fromText, toText } = resolveDateRange(params);
  const { stepRows } = await buildStepStats(from, to);
  return {
    from: fromText,
    to: toText,
    rows: stepRows,
  };
}

export async function getSLAKpiBacklogAging(params?: {
  asOf?: string;
}): Promise<{ as_of: string; buckets: SLAKpiAgingBucket[] }> {
  const asOf = params?.asOf ? new Date(params.asOf) : new Date();
  if (Number.isNaN(asOf.getTime())) {
    throw new Error("Invalid as_of date");
  }
  const pending = await getPendingRequestsWithSLA({ endDate: asOf });
  const buckets: SLAKpiAgingBucket[] = [
    { bucket: "0-3", count: 0 },
    { bucket: "4-7", count: 0 },
    { bucket: "8-14", count: 0 },
    { bucket: "15+", count: 0 },
  ];
  for (const item of pending) {
    const days = Number(item.business_days_elapsed || 0);
    if (days <= 3) buckets[0].count += 1;
    else if (days <= 7) buckets[1].count += 1;
    else if (days <= 14) buckets[2].count += 1;
    else buckets[3].count += 1;
  }
  return {
    as_of: asOf.toISOString().slice(0, 10),
    buckets,
  };
}

export async function getSLAKpiDataQuality(params?: {
  from?: string;
  to?: string;
}): Promise<SLAKpiDataQuality> {
  const { from, to, fromText, toText } = resolveDateRange(params);
  const closed = await SLARepository.findClosedRequestsForKPI(from, to);
  const approvals = await SLARepository.findApprovalsInRangeForKPI(from, to);
  const approvalByRequest = new Map<number, number>();
  approvals.forEach((row) => {
    const requestId = Number(row.request_id);
    approvalByRequest.set(requestId, (approvalByRequest.get(requestId) ?? 0) + 1);
  });
  const closedWithoutSubmit = closed.filter((row) => !row.submitted_at).length;
  const closedWithoutActions = closed.filter(
    (row) => (approvalByRequest.get(Number(row.request_id)) ?? 0) === 0,
  ).length;
  const { quality } = await buildStepStats(from, to);
  return {
    from: fromText,
    to: toText,
    closed_without_submit: closedWithoutSubmit,
    closed_without_actions: closedWithoutActions,
    step_missing_enter: quality.step_missing_enter,
    step_negative_duration: quality.step_negative_duration,
  };
}

function classifyErrorCategory(comment?: string | null): string {
  const text = (comment ?? "").toLowerCase();
  if (!text) return "OTHER";
  if (text.includes("เอกสาร") || text.includes("แนบ") || text.includes("ไฟล์")) return "ATTACHMENT_ISSUE";
  if (text.includes("สิทธิ") || text.includes("เกณฑ์") || text.includes("คุณสมบัติ")) return "POLICY_MISMATCH";
  if (text.includes("ข้อมูล") || text.includes("กรอก") || text.includes("ไม่ครบ")) return "DATA_MISSING";
  if (text.includes("รูปแบบ") || text.includes("ไม่ถูกต้อง")) return "DATA_INVALID";
  if (text.includes("ขั้นตอน") || text.includes("อนุมัติ")) return "WORKFLOW_ERROR";
  return "OTHER";
}

export async function getSLAKpiErrorOverview(params?: {
  from?: string;
  to?: string;
}): Promise<SLAKpiErrorOverview> {
  const { from, to, fromText, toText } = resolveDateRange(params);
  const approvals = await SLARepository.findApprovalsInRangeForKPI(from, to);
  const submittedIds = new Set<number>();
  const returnedIds = new Set<number>();
  const rejectedIds = new Set<number>();
  const errorIds = new Set<number>();

  const categoryCount = new Map<string, number>();
  const stepCount = new Map<number, number>();

  type ApprovalRow = {
    request_id: number;
    step_no: number;
    action: string;
    comment?: string | null;
  };

  (approvals as ApprovalRow[]).forEach((row) => {
    const requestId = Number(row.request_id);
    const action = String(row.action);
    if (action === "SUBMIT") submittedIds.add(requestId);
    if (action === "RETURN") {
      returnedIds.add(requestId);
      errorIds.add(requestId);
      const category = classifyErrorCategory(row.comment ?? null);
      categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
      const stepNo = Number(row.step_no);
      stepCount.set(stepNo, (stepCount.get(stepNo) ?? 0) + 1);
    }
    if (action === "REJECT") {
      rejectedIds.add(requestId);
      errorIds.add(requestId);
      const category = classifyErrorCategory(row.comment ?? null);
      categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
      const stepNo = Number(row.step_no);
      stepCount.set(stepNo, (stepCount.get(stepNo) ?? 0) + 1);
    }
  });

  const closed = await SLARepository.findClosedRequestsForKPI(from, to);
  const statusByRequest = new Map<number, string>();
  (closed as Array<{ request_id: number; status: string }>).forEach((row) => {
    statusByRequest.set(Number(row.request_id), row.status);
  });

  const totalSubmitted = submittedIds.size;
  const totalErrorRequests = errorIds.size;
  const approvedNoReturnCount = Array.from(submittedIds).filter((id) => {
    const status = statusByRequest.get(id);
    return status === "APPROVED" && !returnedIds.has(id);
  }).length;

  const topCategories: SLAKpiErrorCategoryRow[] = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({
      category,
      count,
      ratio: totalErrorRequests > 0 ? Math.round((count / totalErrorRequests) * 100) : 0,
    }));

  const byStep: SLAKpiErrorByStepRow[] = Array.from(stepCount.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([step, errorCount]) => ({
      step,
      role: STEP_ROLE_MAP[step] ?? "UNKNOWN",
      error_count: errorCount,
    }));

  return {
    from: fromText,
    to: toText,
    total_submitted: totalSubmitted,
    total_error_requests: totalErrorRequests,
    error_rate: totalSubmitted > 0 ? Math.round((totalErrorRequests / totalSubmitted) * 100) : 0,
    first_pass_yield: totalSubmitted > 0 ? Math.round((approvedNoReturnCount / totalSubmitted) * 100) : 0,
    return_rate: totalSubmitted > 0 ? Math.round((returnedIds.size / totalSubmitted) * 100) : 0,
    rejection_rate: totalSubmitted > 0 ? Math.round((rejectedIds.size / totalSubmitted) * 100) : 0,
    top_categories: topCategories,
    by_step: byStep,
  };
}

// ─── SLA Reminders ────────────────────────────────────────────────────────────

export async function sendSLAReminders(): Promise<SLAReminderResult> {
  const result: SLAReminderResult = { approaching: 0, overdue: 0, errors: [] };

  try {
    const requests = await getPendingRequestsWithSLA();

    for (const req of requests) {
      const reminderType = req.is_overdue ? "OVERDUE" : "APPROACHING";

      if (!req.is_overdue && !req.is_approaching_sla) {
        continue;
      }

      for (const userId of req.approver_ids) {
        const alreadySent = await SLARepository.wasReminderSentToday(
          req.request_id,
          req.current_step,
          reminderType,
        );

        if (alreadySent) continue;

        try {
          const title = req.is_overdue
            ? `⚠️ คำขอเกิน SLA`
            : `⏰ คำขอใกล้ถึง SLA`;

          const message = req.is_overdue
            ? `คำขอเลขที่ ${req.request_no} เกินกำหนด ${req.days_overdue} วันทำการ`
            : `คำขอเลขที่ ${req.request_no} เหลืออีก ${req.days_until_sla} วันทำการ`;

          await NotificationService.notifyUser(
            userId,
            title,
            message,
            "#",
            "SLA_REMINDER",
          );

          await SLARepository.logReminderSent(
            req.request_id,
            req.current_step,
            userId,
            reminderType,
          );

          if (req.is_overdue) {
            result.overdue++;
          } else {
            result.approaching++;
          }
        } catch (err: any) {
          result.errors.push(`Failed to notify user ${userId}: ${err.message}`);
        }
      }
    }
  } catch (error: any) {
    result.errors.push(`SLA reminder error: ${error.message}`);
  }

  return result;
}
