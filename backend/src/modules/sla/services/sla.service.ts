/**
 * PHTS System - SLA Service Facade
 *
 * Service layer for SLA tracking and management
 */

import { SLARepository } from '@/modules/sla/repositories/sla.repository.js';
import {
  SLAConfig,
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

export async function getPendingRequestsWithSLA(): Promise<RequestSLAInfo[]> {
  const pendingRequests = await SLARepository.findPendingRequestsWithSLA();
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
