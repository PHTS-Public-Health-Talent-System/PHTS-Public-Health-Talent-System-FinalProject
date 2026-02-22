import { LeaveManagementRepository } from '../repositories/leave-management.repository.js';
import type {
  LeaveManagementListQuery,
  LeavePersonnelListQuery,
  LeaveManagementExtensionBody,
  CreateLeaveManagementBody,
  ReplaceLeaveReturnEventsBody,
} from '../leave-management.schema.js';

const repository = new LeaveManagementRepository();

export async function listLeaveManagement(params: LeaveManagementListQuery) {
  return repository.listLeaveManagement(params);
}

export async function countLeaveManagement(params: LeaveManagementListQuery) {
  return repository.countLeaveManagement(params);
}

export async function listLeavePersonnel(params: LeavePersonnelListQuery) {
  return repository.listPersonnel(params);
}

export async function getLeaveManagementStats() {
  return repository.getStats();
}

export async function upsertLeaveManagementExtension(
  payload: LeaveManagementExtensionBody,
  actorId?: number | null,
) {
  const leaveManagementId = payload.leave_management_id ?? payload.leave_record_id;
  if (!leaveManagementId) {
    throw new Error("leave_management_id or leave_record_id is required");
  }
  const requireReport = payload.require_return_report ?? false;
  const noPay = payload.is_no_pay ?? payload.pay_exception ?? false;
  const hasEventPayload = Array.isArray(payload.return_report_events);
  const returnReportEventsPayload = payload.return_report_events ?? [];
  const normalizedEvents = hasEventPayload
    ? returnReportEventsPayload.map((event) => ({
        report_date: event.report_date,
        resume_date: event.resume_date ?? null,
        resume_study_program: event.resume_study_program ?? null,
      }))
    : null;
  const earliestReportDate =
    normalizedEvents && normalizedEvents.length > 0
      ? [...normalizedEvents]
          .sort((a, b) => a.report_date.localeCompare(b.report_date))[0].report_date
      : null;
  const hasEventData = (normalizedEvents?.length ?? 0) > 0;
  const returnStatus =
    payload.return_report_status
    ?? (requireReport ? (hasEventPayload ? (hasEventData ? "DONE" : "PENDING") : "PENDING") : "NOT_REQUIRED");
  const documentDurationDays =
    payload.document_duration_days ??
    (payload.document_start_date && payload.document_end_date
      ? calculateDurationDays(payload.document_start_date, payload.document_end_date)
      : undefined);

  await repository.upsertExtension({
    ...payload,
    leave_management_id: leaveManagementId,
    require_return_report: requireReport,
    pay_exception: noPay,
    is_no_pay: noPay,
    return_report_status: returnStatus,
    return_date:
      payload.return_date
      ?? (hasEventPayload ? (earliestReportDate ?? undefined) : undefined),
    document_duration_days: documentDurationDays,
    created_by: actorId ?? null,
    updated_by: actorId ?? null,
  });

  if (hasEventPayload) {
    // New source of truth for pause/resume events; legacy return_* fields remain for compatibility.
    await repository.replaceLeaveReturnReportEvents(
      leaveManagementId,
      normalizedEvents ?? [],
      actorId ?? null,
    );
  }
}

export const calculateFiscalYear = (dateStr: string): number => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 10 ? year + 544 : year + 543;
};

const calculateDurationDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
};

export async function createLeaveManagement(payload: CreateLeaveManagementBody) {
  const duration =
    payload.duration_days ?? calculateDurationDays(payload.start_date, payload.end_date);
  const fiscalYear = calculateFiscalYear(payload.start_date);
  return repository.insertLeaveManagement({
    citizen_id: payload.citizen_id,
    leave_type: payload.leave_type,
    start_date: payload.start_date,
    end_date: payload.end_date,
    duration_days: duration,
    fiscal_year: fiscalYear,
    remark: payload.remark ?? null,
  });
}


export async function listLeaveManagementDocuments(leaveManagementId: number) {
  return repository.listDocuments(leaveManagementId);
}

export async function addLeaveManagementDocuments(
  leaveManagementId: number,
  files: Express.Multer.File[],
  actorId?: number | null,
) {
  const results: number[] = [];
  for (const file of files) {
    if (!file.path) continue;
    const id = await repository.insertDocument({
      leave_management_id: leaveManagementId,
      file_name: file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      file_path: file.path,
      uploaded_by: actorId ?? null,
    });
    results.push(id);
  }
  return results;
}

export async function deleteLeaveManagementDocument(documentId: number) {
  const doc = await repository.findDocumentById(documentId);
  if (!doc) return { deleted: false, filePath: null };
  const deleted = await repository.deleteDocument(documentId);
  return { deleted, filePath: doc.file_path };
}

export async function deleteLeaveManagementExtension(leaveManagementId: number) {
  return repository.deleteExtension(leaveManagementId);
}

export async function listLeaveReturnReportEvents(leaveManagementId: number) {
  return repository.listLeaveReturnReportEventsByLeaveIds([leaveManagementId]);
}

export async function replaceLeaveReturnReportEvents(
  leaveManagementId: number,
  payload: ReplaceLeaveReturnEventsBody,
  actorId?: number | null,
) {
  const events = payload.events.map((event) => ({
    report_date: event.report_date,
    resume_date: event.resume_date ?? null,
    resume_study_program: event.resume_study_program ?? null,
  }));
  await repository.replaceLeaveReturnReportEvents(
    leaveManagementId,
    events,
    actorId ?? null,
  );

  const meta = await repository.findExtensionReturnMeta(leaveManagementId);
  const requireReturnReport =
    meta?.require_return_report === 0 ? 0 : 1;
  const returnStatus =
    requireReturnReport === 0
      ? "NOT_REQUIRED"
      : events.length > 0
        ? "DONE"
        : "PENDING";
  const earliestReportDate =
    events.length > 0
      ? [...events].sort((a, b) => a.report_date.localeCompare(b.report_date))[0].report_date
      : null;

  await repository.upsertLegacyReturnReportCompat(leaveManagementId, {
    require_return_report: requireReturnReport,
    return_report_status: returnStatus,
    return_date: earliestReportDate,
    actor_id: actorId ?? null,
  });
}
