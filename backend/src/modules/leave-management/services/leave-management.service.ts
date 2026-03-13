import { LeaveManagementRepository } from '../repositories/leave-management.repository.js';
import fs from "node:fs/promises";
import type {
  LeaveManagementListQuery,
  LeavePersonnelListQuery,
  LeaveManagementExtensionBody,
  CreateLeaveManagementBody,
  ReplaceLeaveReturnEventsBody,
} from '../leave-management.schema.js';
import { calculateLeaveQuotaStatus } from './leave-domain.service.js';
import { LEAVE_RULES } from '@/modules/payroll/payroll.constants.js';
import { NotFoundError, ValidationError } from "@shared/utils/errors.js";

const repository = new LeaveManagementRepository();

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: "ลาป่วย",
  personal: "ลากิจส่วนตัว",
  vacation: "ลาพักผ่อนประจำปี",
  wife_help: "ลาไปช่วยเหลือภริยาที่คลอดบุตร",
  maternity: "ลาคลอดบุตร",
  ordain: "ลาอุปสมบทในพระพุทธศาสนา หรือลาไปประกอบพิธีฮัจย์",
  military: "ลาไปเข้ารับการตรวจเลือก หรือเข้ารับการเตรียมพล",
  education: "ลาไปศึกษา ฝึกอบรม ดูงาน หรือปฏิบัติการวิจัย",
  rehab: "ลาไปฟื้นฟูสมรรถภาพด้านอาชีพ",
};

const resolveReferenceQuotaLimit = (
  leaveType: string,
  quotaRow: {
    quota_vacation?: number | string | null;
    quota_personal?: number | string | null;
    quota_sick?: number | string | null;
  } | null,
): number | null => {
  if (!quotaRow) return null;
  if (leaveType === "vacation") {
    return quotaRow.quota_vacation !== null && quotaRow.quota_vacation !== undefined
      ? Number(quotaRow.quota_vacation)
      : null;
  }
  if (leaveType === "personal") {
    return quotaRow.quota_personal !== null && quotaRow.quota_personal !== undefined
      ? Number(quotaRow.quota_personal)
      : null;
  }
  if (leaveType === "sick") {
    return quotaRow.quota_sick !== null && quotaRow.quota_sick !== undefined
      ? Number(quotaRow.quota_sick)
      : null;
  }
  return null;
};

type ReturnReportEventSummaryInput = {
  report_date: string;
  resume_date?: string | null;
  resume_study_program?: string | null;
};

function buildReturnReportCompatSummary(
  events: ReturnReportEventSummaryInput[],
  requireReport: boolean,
) {
  if (!requireReport) {
    return {
      return_report_status: "NOT_REQUIRED" as const,
      return_date: null,
    };
  }

  if (!events.length) {
    return {
      return_report_status: "PENDING" as const,
      return_date: null,
    };
  }

  const latestEvent = [...events].sort((a, b) => a.report_date.localeCompare(b.report_date)).at(-1);
  const isFinalReturn = latestEvent && !latestEvent.resume_date && !latestEvent.resume_study_program;

  return {
    return_report_status: isFinalReturn ? ("DONE" as const) : ("PENDING" as const),
    return_date: isFinalReturn ? (latestEvent?.report_date ?? null) : null,
  };
}

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
    throw new ValidationError("leave_management_id or leave_record_id is required");
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
  const compatSummary =
    hasEventPayload
      ? buildReturnReportCompatSummary(normalizedEvents ?? [], requireReport)
      : null;
  const returnStatus =
    payload.return_report_status
    ?? (hasEventPayload
      ? compatSummary?.return_report_status
      : requireReport
        ? "PENDING"
        : "NOT_REQUIRED");
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
      ?? (hasEventPayload
        ? (compatSummary?.return_date ?? undefined)
        : undefined),
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

export async function getLeaveManagementQuotaStatus(leaveManagementId: number) {
  const leave = await repository.findLeaveManagementQuotaContext(leaveManagementId);
  if (!leave) {
    throw new NotFoundError("รายการวันลา", leaveManagementId);
  }

  const [leaveRows, quotaRow, holidayRows, serviceDates] = await Promise.all([
    repository.listLeaveManagementRowsForQuota(leave.citizen_id, leave.fiscal_year),
    repository.findQuotaRow(leave.citizen_id, leave.fiscal_year),
    repository.findHolidaysForFiscalYear(leave.fiscal_year),
    repository.findEmployeeServiceDates(leave.citizen_id),
  ]);
  const referenceQuotaRow = quotaRow
    ? null
    : await repository.findLatestQuotaRowBeforeFiscalYear(leave.citizen_id, leave.fiscal_year);

  const leaveIds = (leaveRows ?? [])
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const returnEvents = await repository.listLeaveReturnReportEventsByLeaveIds(leaveIds);

  const eventMap = new Map<number, Array<{
    report_date: string;
    resume_date: string | null;
    resume_study_institution: string | null;
    resume_study_program: string | null;
    resume_study_major: string | null;
  }>>();

  for (const event of returnEvents) {
    const leaveId = Number(event.leave_record_id);
    if (!Number.isFinite(leaveId)) continue;
    let leaveEvents = eventMap.get(leaveId);
    if (!leaveEvents) {
      leaveEvents = [];
      eventMap.set(leaveId, leaveEvents);
    }
    leaveEvents.push({
      report_date: String(event.report_date),
      resume_date: event.resume_date ? String(event.resume_date) : null,
      resume_study_institution: event.resume_study_institution ?? null,
      resume_study_program: event.resume_study_program ?? null,
      resume_study_major: event.resume_study_major ?? null,
    });
  }

  const leaveRowsWithEvents = (leaveRows ?? []).map((row) => ({
    ...row,
    return_report_events: eventMap.get(Number(row.id)) ?? [],
  }));

  let serviceStartDate: Date | null = null;
  if (serviceDates?.start_work_date) {
    serviceStartDate = new Date(serviceDates.start_work_date);
  } else if (serviceDates?.first_entry_date) {
    serviceStartDate = new Date(serviceDates.first_entry_date);
  }

  const today = new Date();
  const projectedStatus = calculateLeaveQuotaStatus({
    leaveRows: leaveRowsWithEvents,
    holidays: holidayRows ?? [],
    quota: quotaRow ?? {},
    rules: LEAVE_RULES,
    serviceStartDate,
  });
  const currentStatus = calculateLeaveQuotaStatus({
    leaveRows: leaveRowsWithEvents,
    holidays: holidayRows ?? [],
    quota: quotaRow ?? {},
    rules: LEAVE_RULES,
    serviceStartDate,
    rangeEnd: today,
  });

  const leaveStartDate = new Date((leaveRows ?? []).find((row) => Number(row.id) === leaveManagementId)?.document_start_date
    ?? (leaveRows ?? []).find((row) => Number(row.id) === leaveManagementId)?.start_date
    ?? today);
  const leaveEndDate = new Date((leaveRows ?? []).find((row) => Number(row.id) === leaveManagementId)?.document_end_date
    ?? (leaveRows ?? []).find((row) => Number(row.id) === leaveManagementId)?.end_date
    ?? today);

  const leaveStatus =
    today < leaveStartDate
      ? "upcoming"
      : today > leaveEndDate
        ? "completed"
        : "active";

  const quotaTypes = new Set([
    ...Object.keys(projectedStatus.perType),
    ...Object.keys(currentStatus.perType),
  ]);

  const quotas = Array.from(quotaTypes)
    .map((leaveType) => {
      const projectedQuota = projectedStatus.perType[leaveType];
      const currentQuota = currentStatus.perType[leaveType];
      const limit = projectedQuota?.limit ?? currentQuota?.limit ?? null;
      return {
        leave_type: leaveType,
        type_name: LEAVE_TYPE_LABELS[leaveType] ?? leaveType,
        rule_type: LEAVE_RULES[leaveType]?.rule_type ?? "cumulative",
        tracks_balance: (LEAVE_RULES[leaveType]?.rule_type ?? "cumulative") === "cumulative",
        limit,
        reference_fiscal_year:
          limit === null && referenceQuotaRow?.fiscal_year
            ? Number(referenceQuotaRow.fiscal_year)
            : null,
        reference_limit:
          limit === null
            ? resolveReferenceQuotaLimit(leaveType, referenceQuotaRow)
            : null,
        used_as_of_today: currentQuota?.used ?? 0,
        remaining_as_of_today: currentQuota?.remaining ?? null,
        used_after_leave: projectedQuota?.used ?? currentQuota?.used ?? 0,
        remaining_after_leave:
          projectedQuota?.remaining ?? currentQuota?.remaining ?? null,
        over_quota_after_leave: projectedQuota?.overQuota ?? false,
        exceed_date_after_leave: projectedQuota?.exceedDate ?? null,
        has_quota_data: limit !== null,
      };
    })
    .sort((a, b) => a.type_name.localeCompare(b.type_name, "th"));

  const projectedCurrentQuota = projectedStatus.perType[leave.leave_type];
  const currentCurrentQuota = currentStatus.perType[leave.leave_type];

  return {
    leave_id: leave.id,
    fiscal_year: leave.fiscal_year,
    as_of_date: today.toISOString().slice(0, 10),
    current_leave: projectedCurrentQuota || currentCurrentQuota
      ? {
          leave_type: leave.leave_type,
          type_name: LEAVE_TYPE_LABELS[leave.leave_type] ?? leave.leave_type,
          duration: Number(leave.duration_days ?? 0),
          leave_status: leaveStatus,
          rule_type: LEAVE_RULES[leave.leave_type]?.rule_type ?? "cumulative",
          tracks_balance:
            (LEAVE_RULES[leave.leave_type]?.rule_type ?? "cumulative") === "cumulative",
          limit: projectedCurrentQuota?.limit ?? currentCurrentQuota?.limit ?? null,
          reference_fiscal_year:
            (projectedCurrentQuota?.limit ?? currentCurrentQuota?.limit ?? null) === null
            && referenceQuotaRow?.fiscal_year
              ? Number(referenceQuotaRow.fiscal_year)
              : null,
          reference_limit:
            (projectedCurrentQuota?.limit ?? currentCurrentQuota?.limit ?? null) === null
              ? resolveReferenceQuotaLimit(leave.leave_type, referenceQuotaRow)
              : null,
          used_as_of_today: currentCurrentQuota?.used ?? 0,
          remaining_as_of_today: currentCurrentQuota?.remaining ?? null,
          used_after_leave:
            projectedCurrentQuota?.used ?? currentCurrentQuota?.used ?? 0,
          remaining_after_leave:
            projectedCurrentQuota?.remaining
            ?? currentCurrentQuota?.remaining
            ?? null,
          over_quota_after_leave: projectedCurrentQuota?.overQuota ?? false,
          exceed_date_after_leave: projectedCurrentQuota?.exceedDate ?? null,
          has_quota_data:
            (projectedCurrentQuota?.limit ?? currentCurrentQuota?.limit ?? null) !== null,
        }
      : null,
    quotas,
  };
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
  if (deleted && doc.file_path) {
    await fs.unlink(doc.file_path).catch(() => undefined);
  }
  return { deleted, filePath: null };
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
  const compatSummary = buildReturnReportCompatSummary(events, requireReturnReport !== 0);

  await repository.upsertLegacyReturnReportCompat(leaveManagementId, {
    require_return_report: requireReturnReport,
    return_report_status: compatSummary.return_report_status,
    return_date: compatSummary.return_date,
    actor_id: actorId ?? null,
  });
}
