import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { getSLAReport } from '@/modules/sla/services/sla.service.js';
import { shouldSendAlert, logAlert } from '@/modules/workforce-compliance/services/jobs/shared/job-alert-helpers.js';

export async function runSLADigest(): Promise<{ sent: number }> {
  const report = await getSLAReport();
  let sent = 0;

  for (const step of report.byStep) {
    if (step.count === 0) continue;
    if (!(await shouldSendAlert('SLA_DIGEST', 'role', step.role, new Date()))) continue;

    await NotificationService.notifyRoleByTemplate(
      step.role,
      'WORKFORCE_SLA_DIGEST_ROLE',
      {
        count: step.count,
        overdue: step.overdue,
      },
    );

    await logAlert({
      alertType: 'SLA_DIGEST',
      referenceType: 'role',
      referenceId: step.role,
    });
    sent += 1;
  }

  return { sent };
}
