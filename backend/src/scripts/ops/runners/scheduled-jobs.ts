import {
  runLicenseAutoCutRestore,
  runRetirementCutoff,
  runMovementOutCutoff,
  runSLADigest,
  runLeaveReportAlerts,
} from '@/modules/workforce-compliance/services/workforce-compliance-jobs.service.js';
import {
  autoDisableTerminatedUsers,
  sendReviewReminders,
} from '@/modules/access-review/services/access-review.service.js';
import {
  runBackupJob,
  shouldRunScheduledBackup,
} from '@/modules/backup/services/backup.service.js';
import { sendLicenseAlertDigest } from '@/modules/workforce-compliance/services/license-compliance.digest.service.js';
import { NotificationOutboxService } from '@/modules/notification/services/notification-outbox.service.js';
import { ALERT_JOB_TIMEZONE } from '@/modules/workforce-compliance/constants/workforce-compliance-policy.js';
import { processSnapshotOutboxBatch } from '@/modules/snapshot/services/snapshot.service.js';

type JobName =
  | "sla"
  | "leave-report"
  | "military-leave"
  | "license-auto-cut"
  | "retirement-cut"
  | "movement-cut"
  | "access-review"
  | "backup"
  | "license-alerts"
  | "notification-outbox"
  | "snapshot-outbox";

const JOBS: JobName[] = [
  "sla",
  "leave-report",
  "military-leave",
  "license-auto-cut",
  "retirement-cut",
  // keep as on-demand safety net; not in default run
  // "movement-cut",
  "access-review",
  "backup",
  "license-alerts",
  "notification-outbox",
  "snapshot-outbox",
];

async function runJob(job: JobName): Promise<void> {
  const startedAt = Date.now();
  console.log(`[job:start] ${job}`);

  if (job === "sla") {
    const result = await runSLADigest();
    console.log("[sla] digest", result);
    console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
    return;
  }

  if (job === "access-review") {
    const disabled = await autoDisableTerminatedUsers();
    const reminders = await sendReviewReminders();
    console.log("[access-review] auto-disable", disabled);
    console.log("[access-review] reminders", reminders);
    console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
    return;
  }


  if (job === "backup") {
    const shouldRun = await shouldRunScheduledBackup();
    if (!shouldRun) {
      console.log("[backup] skipped (not scheduled time or already run today)");
      console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
      return;
    }
    const result = await runBackupJob({ triggerSource: "SCHEDULED" });
    console.log("[backup]", result);
    console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
    return;
  }

  if (job === "leave-report" || job === "military-leave") {
    const result = await runLeaveReportAlerts();
    console.log("[leave-report] alerts", result);
    console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
    return;
  }

  if (job === "license-auto-cut") {
    const result = await runLicenseAutoCutRestore();
    console.log("[license-auto-cut] result", result);
    console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
    return;
  }

  if (job === "retirement-cut") {
    const result = await runRetirementCutoff();
    console.log("[retirement-cut] result", result);
    console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
    return;
  }

  if (job === "movement-cut") {
    const result = await runMovementOutCutoff();
    console.log("[movement-cut] result", result);
    console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
    return;
  }

  if (job === "license-alerts") {
    const result = await sendLicenseAlertDigest();
    console.log("[license-alerts] digest", result);
    console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
    return;
  }

  if (job === "notification-outbox") {
    const result = await NotificationOutboxService.processBatch(200);
    console.log("[notification-outbox]", result);
    console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
    return;
  }

  if (job === "snapshot-outbox") {
    const result = await processSnapshotOutboxBatch(100);
    console.log("[snapshot-outbox]", result);
    console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
    return;
  }
}

async function main(): Promise<void> {
  console.log(`[jobs] timezone=${ALERT_JOB_TIMEZONE}`);
  const args = process.argv.slice(2);
  const selected = args.length
    ? (args.filter((arg) => JOBS.includes(arg as JobName)) as JobName[])
    : JOBS;

  if (!selected.length) {
    console.error(`No valid jobs specified. Use: ${JOBS.join(", ")}`);
    process.exit(1);
  }

  for (const job of selected) {
    try {
      await runJob(job);
    } catch (error: any) {
      console.error(`[${job}] failed:`, error.message);
    }
  }
}

main().catch((error) => {
  console.error("Scheduled jobs runner failed:", error);
  process.exit(1);
});
