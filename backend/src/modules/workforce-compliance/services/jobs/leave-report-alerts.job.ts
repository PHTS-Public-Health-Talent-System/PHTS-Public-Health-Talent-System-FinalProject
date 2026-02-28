import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';
import {
  OPS_JOB_TIMEZONE,
  LEAVE_REPORT_POLICY,
  resolveLeavePolicy,
} from '@/modules/workforce-compliance/constants/workforce-compliance-policy.js';
import { shouldSendAlert, logAlert } from '@/modules/workforce-compliance/services/jobs/shared/job-alert-helpers.js';

export async function runLeaveReportAlerts(): Promise<{ sent: number }> {
  const asOf = new Date();
  const stats = {
    candidates: 0,
    sent: 0,
    skippedDedup: 0,
    skippedNoUser: 0,
    failed: 0,
  };

  const ordain = await WorkforceComplianceRepository.getLeaveReportCandidates(
    ['ordain'],
    LEAVE_REPORT_POLICY.ordain.windowDays,
    asOf,
  );
  const military = await WorkforceComplianceRepository.getLeaveReportCandidates(
    ['military'],
    LEAVE_REPORT_POLICY.military.windowDays,
    asOf,
  );

  const candidates = [...ordain, ...military];
  stats.candidates = candidates.length;

  for (const row of candidates) {
    const policy = resolveLeavePolicy(row.leave_type);
    const maxDays = policy.overdueDays;
    const isOverdue = row.days_since_end > policy.overdueDays;
    const referenceId = String(row.leave_record_id);
    if (!(await shouldSendAlert('LEAVE_REPORT', 'leave_record', referenceId, asOf))) {
      stats.skippedDedup += 1;
      continue;
    }

    const userId = await WorkforceComplianceRepository.findUserIdByCitizenId(row.citizen_id);
    if (!userId) {
      stats.skippedNoUser += 1;
      continue;
    }

    const templateKey = isOverdue
      ? 'WORKFORCE_LEAVE_REPORT_OVERDUE_USER'
      : 'WORKFORCE_LEAVE_REPORT_DUE_USER';

    try {
      await NotificationService.notifyUserByTemplate(userId, templateKey, {
        maxDays,
        daysSinceEnd: row.days_since_end,
      });

      await logAlert({
        alertType: 'LEAVE_REPORT',
        referenceType: 'leave_record',
        referenceId,
        targetUserId: userId,
      });
      stats.sent += 1;
    } catch (error) {
      stats.failed += 1;
      await logAlert({
        alertType: 'LEAVE_REPORT',
        referenceType: 'leave_record',
        referenceId,
        targetUserId: userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  console.info(
    `[leave-report] tz=${OPS_JOB_TIMEZONE} candidates=${stats.candidates} sent=${stats.sent} dedup=${stats.skippedDedup} no_user=${stats.skippedNoUser} failed=${stats.failed}`,
  );

  return { sent: stats.sent };
}
