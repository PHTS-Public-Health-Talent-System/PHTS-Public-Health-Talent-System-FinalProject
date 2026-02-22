import { RowDataPacket } from "mysql2/promise";
import {
  LEAVE_RULES,
  RETURN_REPORT_REQUIRED_LEAVE_TYPES,
} from '@/modules/payroll/payroll.constants.js';
import {
  formatLocalDate,
  isHoliday,
} from '@/modules/payroll/core/utils.js';

export interface LeaveRow extends RowDataPacket {
  id?: number;
  leave_type: string;
  start_date: Date | string;
  end_date: Date | string;
  duration_days: number;
  document_start_date?: Date | string | null;
  document_end_date?: Date | string | null;
  document_duration_days?: number | null;
  is_no_pay?: number | null;
  pay_exception?: number | null;
}

type QuotaValue = number | string | null;

export interface QuotaRow extends RowDataPacket {
  quota_vacation?: QuotaValue;
  quota_personal?: QuotaValue;
  quota_sick?: QuotaValue;
}

export interface NoSalaryPeriodRow extends RowDataPacket {
  leave_record_id?: number | null;
  leave_type?: string | null;
  start_date: Date | string;
  end_date: Date | string;
}

export interface ReturnReportRow extends RowDataPacket {
  leave_record_id: number;
  return_date: Date | string;
}

export type DeductionReasonCode = "NO_PAY" | "OVER_QUOTA";

export type DeductionReason = {
  code: DeductionReasonCode;
  // ค่าน้ำหนักของการหักในวันนั้น (เช่น 0.5 หรือ 1)
  weight: number;
  leave_record_id?: number | null;
  leave_type?: string | null;
  exceed_date?: Date | null;
};

export type DeductionResult = {
  deductionMap: Map<string, number>;
  reasonsByDate: Map<string, DeductionReason[]>;
};

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;
const resolveEffectiveDate = (primary: Date | string | null | undefined, fallback: Date | string) =>
  primary ? new Date(primary) : new Date(fallback);

// ใช้กับวันลาแบบไม่รับเงิน (NO_PAY)
// ฟังก์ชันนี้ถูกเรียกจาก applyLeaveDeduction() และ applyNoSalaryPeriods()
// เพื่อบันทึกวันหักลง deductionMap/reasonsByDate
const applyNoPayLeave = (
  deductionMap: Map<string, number>,
  reasonsByDate: Map<string, DeductionReason[]>,
  start: Date,
  end: Date,
  monthStart: Date,
  monthEnd: Date,
  reasonBase: Omit<DeductionReason, "weight">,
) => {
  const monthStartStr = formatLocalDate(monthStart);
  const monthEndStr = formatLocalDate(monthEnd);
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = formatLocalDate(cursor);
    if (dateStr >= monthStartStr && dateStr <= monthEndStr) {
      const before = deductionMap.get(dateStr) || 0;
      const after = Math.max(before, 1);
      const contribution = after - before;
      if (contribution > 0) {
        deductionMap.set(dateStr, after);
        const existing = reasonsByDate.get(dateStr) || [];
        existing.push({ ...reasonBase, weight: contribution });
        reasonsByDate.set(dateStr, existing);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
};

const resolveHalfDayLeaveWeight = (
  leave: LeaveRow,
  start: Date,
  holidays: string[],
): { isHalfDay: boolean } => {
  // คำนวณจำนวนวันลา โดยอ้างกฎจาก LEAVE_RULES (ไฟล์ payroll.constants.ts)
  // และใช้วันหยุดจาก core/utils.ts (isHoliday/countBusinessDays/countCalendarDays)
  const durationOverride = leave.document_duration_days ?? leave.duration_days ?? null;
  const isHalfDay = durationOverride !== null && durationOverride > 0 && durationOverride < 1;
  if (isHalfDay) {
      const dateStr = formatLocalDate(start);
      if (!isHoliday(dateStr, holidays) && !isWeekend(start)) {
      return { isHalfDay: true };
    }
    return { isHalfDay: true };
  }
  return { isHalfDay: false };
};

type PenaltyContext = {
  deductionMap: Map<string, number>;
  reasonsByDate: Map<string, DeductionReason[]>;
  exceedDate: Date;
  end: Date;
  weight: number;
  ruleUnit: string;
  holidays: string[];
  monthStart: Date;
  monthEnd: Date;
  reasonBase: Omit<DeductionReason, "weight">;
};

export type QuotaDecision = {
  overQuota: boolean;
  exceedDate: Date | null;
};

const applyOverQuotaPenalty = ({
  deductionMap,
  reasonsByDate,
  exceedDate,
  end,
  weight,
  ruleUnit,
  holidays,
  monthStart,
  monthEnd,
  reasonBase,
}: PenaltyContext) => {
  const monthStartStr = formatLocalDate(monthStart);
  const monthEndStr = formatLocalDate(monthEnd);
  // ใช้ลงโทษช่วงลาเกินสิทธิ โดยหักตั้งแต่ exceedDate ถึง end
  // ฟังก์ชันนี้ถูกเรียกจาก applyLeaveDeduction()
  // และ end มาจาก resolveOverQuotaPenaltyEnd() เพื่อรองรับกรณีลาศึกษา + วันรายงานตัวกลับ
  const penaltyCursor = new Date(exceedDate);
  while (penaltyCursor <= end) {
    const dateStr = formatLocalDate(penaltyCursor);
    const isHol = isHoliday(dateStr, holidays);
    const weekend = isWeekend(penaltyCursor);

    if (ruleUnit === "calendar_days" || (!isHol && !weekend)) {
      if (dateStr >= monthStartStr && dateStr <= monthEndStr) {
        const before = deductionMap.get(dateStr) || 0;
        const after = Math.min(1, before + weight);
        const contribution = after - before;
        if (contribution > 0) {
          deductionMap.set(dateStr, after);
          const existing = reasonsByDate.get(dateStr) || [];
          existing.push({ ...reasonBase, weight: contribution });
          reasonsByDate.set(dateStr, existing);
        }
      }
    }
    penaltyCursor.setDate(penaltyCursor.getDate() + 1);
  }
};

export function calculateDeductions(
  leaves: LeaveRow[],
  holidays: string[],
  monthStart: Date,
  monthEnd: Date,
  quotaDecisions: Map<number, QuotaDecision>,
  noSalaryPeriods: NoSalaryPeriodRow[] = [],
  returnReports: Map<number, Date> = new Map(),
): DeductionResult {
  // จุดเรียกหลักอยู่ที่ core/calculator.ts
  // quotaDecisions ต้องถูกเตรียมมาจาก leave-domain.service.ts ก่อนเสมอ
  const deductionMap = new Map<string, number>();
  const reasonsByDate = new Map<string, DeductionReason[]>();

  const sortedLeaves = [...leaves].sort(
    (a, b) =>
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );

  // Runtime guard: กันกรณี call มาผิดรูปแบบจากชั้นบน
  if (!quotaDecisions) {
    throw new Error(
      "[payroll][deductions] quota decisions required but not provided",
    );
  }

  for (const leave of sortedLeaves) {
    // ถ้ามีการแก้วันลาในเอกสาร ให้ใช้วันที่จากเอกสารเป็นหลัก
    const start = resolveEffectiveDate(leave.document_start_date, leave.start_date);
    const end = resolveEffectiveDate(leave.document_end_date, leave.end_date);
    applyLeaveDeduction(leave, {
      deductionMap,
      reasonsByDate,
      holidays,
      monthStart,
      monthEnd,
      start,
      end,
      returnReports,
      quotaDecisions,
    });
  }

  // เติมช่วง noSalaryPeriods อีกรอบ เพื่อกันข้อมูลตกหล่นจากตารางส่วนขยาย
  applyNoSalaryPeriods(deductionMap, reasonsByDate, noSalaryPeriods, monthStart, monthEnd);

  return { deductionMap, reasonsByDate };
}

type LeaveDeductionContext = {
  deductionMap: Map<string, number>;
  reasonsByDate: Map<string, DeductionReason[]>;
  holidays: string[];
  monthStart: Date;
  monthEnd: Date;
  start: Date;
  end: Date;
  returnReports: Map<number, Date>;
  quotaDecisions: Map<number, QuotaDecision>;
};

function applyLeaveDeduction(leave: LeaveRow, context: LeaveDeductionContext) {
  // ถ้าเป็น no-pay ให้หักทันที แล้วจบในสาขานี้
  if (isNoPayLeave(leave)) {
    applyNoPayLeave(
      context.deductionMap,
      context.reasonsByDate,
      context.start,
      context.end,
      context.monthStart,
      context.monthEnd,
      {
        code: "NO_PAY",
        leave_record_id: leave.id ?? null,
        leave_type: leave.leave_type,
      },
    );
    return;
  }

  const rule = LEAVE_RULES[leave.leave_type];
  if (!rule) return;

  if (leave.id === undefined || leave.id === null) {
    throw new Error("[payroll][deductions] paid leave requires id");
  }

  const decision = context.quotaDecisions.get(Number(leave.id));

  const { isHalfDay } = resolveHalfDayLeaveWeight(
    leave,
    context.start,
    context.holidays,
  );

  if (!decision) {
    throw new Error(
      `[payroll][deductions] quota decision missing for leave id=${Number(leave.id)}`,
    );
  }

  // ใช้ผล overQuota/exceedDate ที่คำนวณไว้ล่วงหน้าจาก leave-domain
  // (ถูกสร้างใน calculator.ts แล้วส่งเข้ามาใน quotaDecisions)
  if (decision.overQuota && decision.exceedDate) {
    const weight = isHalfDay ? 0.5 : 1;
    const penaltyEnd = resolveOverQuotaPenaltyEnd(
      leave,
      context.end,
      context.returnReports,
    );
    applyOverQuotaPenalty({
      deductionMap: context.deductionMap,
      reasonsByDate: context.reasonsByDate,
      exceedDate: decision.exceedDate,
      end: penaltyEnd,
      weight,
      ruleUnit: rule.unit,
      holidays: context.holidays,
      monthStart: context.monthStart,
      monthEnd: context.monthEnd,
      reasonBase: {
        code: "OVER_QUOTA",
        leave_record_id: leave.id ?? null,
        leave_type: leave.leave_type,
        exceed_date: decision.exceedDate,
      },
    });
  }
}

function isNoPayLeave(leave: LeaveRow): boolean {
  return Number(leave.is_no_pay ?? 0) === 1;
}

function applyNoSalaryPeriods(
  deductionMap: Map<string, number>,
  reasonsByDate: Map<string, DeductionReason[]>,
  periods: NoSalaryPeriodRow[],
  monthStart: Date,
  monthEnd: Date,
) {
  // noSalaryPeriods ถูกส่งมาจาก calculator.ts
  // โดย query จาก leave_record_extensions (is_no_pay/pay_exception)
  for (const period of periods) {
    const start = new Date(period.start_date);
    const end = new Date(period.end_date);
    applyNoPayLeave(deductionMap, reasonsByDate, start, end, monthStart, monthEnd, {
      code: "NO_PAY",
      leave_record_id: period.leave_record_id ?? null,
      leave_type: period.leave_type ?? null,
    });
  }
}

function resolveOverQuotaPenaltyEnd(
  leave: LeaveRow,
  leaveEnd: Date,
  returnReports: Map<number, Date>,
): Date {
  // return report ใช้กับกลุ่มลาที่ต้อง "กลับมารายงานตัว":
  // - education (ลาศึกษาต่อ/อบรม)
  // - ordain (ลาอุปสมบท)
  // - military (ลาเข้ารับการตรวจเลือก/เตรียมพล)
  const returnReportTypes = new Set<string>(RETURN_REPORT_REQUIRED_LEAVE_TYPES);
  if (!returnReportTypes.has(String(leave.leave_type ?? ""))) return leaveEnd;
  if (!leave.id) return leaveEnd;

  const returnDate = returnReports.get(leave.id);
  if (!returnDate) {
    // ปิด logic ขยายการหักถึงสิ้นเดือนกรณีไม่พบรายงานตัวกลับ
    // ตอนนี้ให้ยึด leaveEnd เป็นหลัก และไปแจ้งเตือนผ่าน checks แทน
    return leaveEnd;
  }

  const adjusted = new Date(returnDate);
  adjusted.setDate(adjusted.getDate() - 1);

  if (adjusted < leaveEnd) {
    return adjusted;
  }
  return leaveEnd;
}
