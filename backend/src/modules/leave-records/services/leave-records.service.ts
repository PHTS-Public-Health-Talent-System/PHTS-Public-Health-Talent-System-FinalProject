import { LeaveRecordsRepository } from '../repositories/leave-records.repository.js';
import type {
  LeaveRecordListQuery,
  LeavePersonnelListQuery,
  LeaveRecordExtensionBody,
  CreateLeaveRecordBody,
} from '../leave-records.schema.js';

const repository = new LeaveRecordsRepository();

export async function listLeaveRecords(params: LeaveRecordListQuery) {
  return repository.listLeaveRecords(params);
}

export async function countLeaveRecords(params: LeaveRecordListQuery) {
  return repository.countLeaveRecords(params);
}

export async function listLeavePersonnel(params: LeavePersonnelListQuery) {
  return repository.listPersonnel(params);
}

export async function getLeaveRecordStats() {
  return repository.getStats();
}

export async function upsertLeaveRecordExtension(
  payload: LeaveRecordExtensionBody,
  actorId?: number | null,
) {
  const requireReport = payload.require_return_report ?? false;
  const noPay = payload.is_no_pay ?? payload.pay_exception ?? false;
  const returnStatus = payload.return_report_status ?? (requireReport ? "PENDING" : "NOT_REQUIRED");
  const documentDurationDays =
    payload.document_duration_days ??
    (payload.document_start_date && payload.document_end_date
      ? calculateDurationDays(payload.document_start_date, payload.document_end_date)
      : undefined);

  return repository.upsertExtension({
    ...payload,
    require_return_report: requireReport,
    pay_exception: noPay,
    is_no_pay: noPay,
    return_report_status: returnStatus,
    document_duration_days: documentDurationDays,
    created_by: actorId ?? null,
    updated_by: actorId ?? null,
  });
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

export async function createLeaveRecord(payload: CreateLeaveRecordBody) {
  const duration =
    payload.duration_days ?? calculateDurationDays(payload.start_date, payload.end_date);
  const fiscalYear = calculateFiscalYear(payload.start_date);
  return repository.insertLeaveRecord({
    citizen_id: payload.citizen_id,
    leave_type: payload.leave_type,
    start_date: payload.start_date,
    end_date: payload.end_date,
    duration_days: duration,
    fiscal_year: fiscalYear,
    remark: payload.remark ?? null,
  });
}


export async function listLeaveRecordDocuments(leaveRecordId: number) {
  return repository.listDocuments(leaveRecordId);
}

export async function addLeaveRecordDocuments(
  leaveRecordId: number,
  files: Express.Multer.File[],
  actorId?: number | null,
) {
  const results: number[] = [];
  for (const file of files) {
    if (!file.path) continue;
    const id = await repository.insertDocument({
      leave_record_id: leaveRecordId,
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

export async function deleteLeaveRecordDocument(documentId: number) {
  const doc = await repository.findDocumentById(documentId);
  if (!doc) return { deleted: false, filePath: null };
  const deleted = await repository.deleteDocument(documentId);
  return { deleted, filePath: doc.file_path };
}

export async function deleteLeaveRecordExtension(leaveRecordId: number) {
  return repository.deleteExtension(leaveRecordId);
}
