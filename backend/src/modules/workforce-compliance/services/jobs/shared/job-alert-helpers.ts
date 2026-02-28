import crypto from 'node:crypto';
import { AlertLogsRepository } from '@/modules/workforce-compliance/repositories/alert-logs.repository.js';
import type { AlertType } from '@/modules/workforce-compliance/entities/workforce-compliance.entity.js';
import { formatOpsDate } from '@/modules/workforce-compliance/services/jobs/shared/job-date.js';

const hashKey = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export async function shouldSendAlert(
  alertType: AlertType,
  referenceType: string,
  referenceId: string,
  date: Date = new Date(),
): Promise<boolean> {
  const dedupeKey = `${alertType}:${referenceType}:${referenceId}:${formatOpsDate(date)}`;
  const payloadHash = hashKey(dedupeKey);
  const exists = await AlertLogsRepository.hasPayloadHash(payloadHash);
  return !exists;
}

export async function logAlert(params: {
  alertType: AlertType;
  referenceType: string;
  referenceId: string;
  targetUserId?: number | null;
  errorMessage?: string | null;
}): Promise<void> {
  const sentAt = new Date();
  const dedupeKey = `${params.alertType}:${params.referenceType}:${params.referenceId}:${formatOpsDate(sentAt)}`;
  const payloadHash = hashKey(dedupeKey);
  await AlertLogsRepository.insertLog({
    alert_type: params.alertType,
    target_user_id: params.targetUserId ?? null,
    reference_type: params.referenceType,
    reference_id: params.referenceId,
    payload_hash: payloadHash,
    status: params.errorMessage ? 'FAILED' : 'SENT',
    error_message: params.errorMessage ?? null,
    sent_at: sentAt,
  });
}
