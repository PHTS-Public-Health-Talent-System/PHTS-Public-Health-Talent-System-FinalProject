import type { LeavePersonnelRow, LeaveRecordApiRow } from "@/features/leave-management/api";
import { leaveTypes } from "@/features/leave-management/constants/leaveTypes";
import type { LeaveRecord } from "@/features/leave-management/types/leaveManagement.types";
import { deriveReturnReportStatus } from "@/features/leave-management/utils/reportStatus";

type LeavePerson = {
  id: string;
  name: string;
  position: string;
  department: string;
};

export function mapLeavePersonnel(rows: LeavePersonnelRow[] | undefined): LeavePerson[] {
  if (!Array.isArray(rows)) return [];

  const map = new Map<string, LeavePerson>();
  rows.forEach((row) => {
    const citizenId = String(row.citizen_id ?? "");
    if (!citizenId || map.has(citizenId)) return;
    const name = `${row.title ?? ""}${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || citizenId;
    map.set(citizenId, {
      id: citizenId,
      name,
      position: row.position_name ?? "-",
      department: row.department ?? "-",
    });
  });
  return Array.from(map.values());
}

export function toLeavePersonMap(personnel: LeavePerson[]): Map<string, Omit<LeavePerson, "id">> {
  const map = new Map<string, Omit<LeavePerson, "id">>();
  personnel.forEach((person) => {
    map.set(person.id, {
      name: person.name,
      position: person.position,
      department: person.department,
    });
  });
  return map;
}

function calcInclusiveDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
}

export function mapLeaveRows(
  rows: LeaveRecordApiRow[],
  personMap: Map<string, { name: string; position: string; department: string }>,
): LeaveRecord[] {
  return rows.map((row) => {
    const citizenId = String(row.citizen_id ?? "");
    const person = personMap.get(citizenId);
    const rawType = String(row.leave_type ?? "").toLowerCase();
    const type = leaveTypes.some((t) => t.value === rawType) ? rawType : "personal";
    const typeLabel = leaveTypes.find((t) => t.value === type)?.label ?? "อื่นๆ";
    const userStart = row.start_date ?? "";
    const userEnd = row.end_date ?? "";
    const userDays = calcInclusiveDays(userStart, userEnd);
    const documentDays = row.document_duration_days
      ? Number(row.document_duration_days)
      : calcInclusiveDays(row.document_start_date ?? "", row.document_end_date ?? "");
    const requiresReport = Boolean(row.require_return_report ?? false);
    const reportStatus = deriveReturnReportStatus({
      requireReport: requiresReport,
      returnDate: row.return_date ?? null,
    });
    const fallbackName = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();

    return {
      id: Number(row.id),
      source: "hrms" as const,
      personId: citizenId,
      personName: person?.name ?? (fallbackName || citizenId),
      personPosition: person?.position ?? row.position_name ?? "-",
      personDepartment: person?.department ?? row.department ?? "-",
      type,
      typeName: typeLabel,
      userStartDate: userStart,
      userEndDate: userEnd,
      documentStartDate: row.document_start_date ?? "",
      documentEndDate: row.document_end_date ?? "",
      days: userDays,
      requireReport: requiresReport,
      reportDate: row.return_date ?? undefined,
      reportStatus,
      studyInfo: row.study_institution
        ? {
            institution: row.study_institution,
            program: row.study_program ?? "-",
            field: row.study_major ?? "-",
            startDate: row.study_start_date ?? "",
          }
        : undefined,
      note: row.note ?? row.remark ?? undefined,
      createdAt: String(row.start_date ?? ""),
      documentDays,
    };
  });
}

export function getLeaveTypeColor(type: string): string {
  const leaveType = leaveTypes.find((t) => t.value === type);
  return leaveType?.color || "bg-secondary text-muted-foreground border-border";
}
