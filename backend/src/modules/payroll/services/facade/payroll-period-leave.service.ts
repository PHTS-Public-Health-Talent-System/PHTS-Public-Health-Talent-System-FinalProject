import {
  LeaveManagementPeriodQuery,
  LeaveManagementRepository,
} from "@/modules/leave-management/repositories/leave-management.repository.js";
import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository.js";

const resolvePeriodRange = async (periodId: number) => {
  const period = await PayrollRepository.findPeriodById(periodId);
  if (!period) throw new Error("Period not found");

  const month = Number(period.period_month ?? 0);
  const rawYear = Number(period.period_year ?? 0);
  const year = rawYear > 2400 ? rawYear - 543 : rawYear;
  if (month <= 0 || year <= 0) {
    throw new Error("Invalid period");
  }

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  return { period, startDate, endDate };
};

const resolvePayrollCitizenIds = async (periodId: number): Promise<string[]> => {
  const payoutRows = await PayrollRepository.findPayoutsByPeriod(periodId);
  const payoutCitizenIds = payoutRows
    .map((row: any) => String(row?.citizen_id ?? "").trim())
    .filter((value) => value.length > 0);
  if (payoutCitizenIds.length > 0) {
    return [...new Set(payoutCitizenIds)];
  }

  const conn = await PayrollRepository.getConnection();
  try {
    const periodItemCitizenIds = await PayrollRepository.findPeriodItemCitizenIds(periodId, conn);
    return periodItemCitizenIds
      .map((value) => String(value ?? "").trim())
      .filter((value) => value.length > 0);
  } finally {
    conn.release();
  }
};

export class PayrollPeriodLeaveService {
  static async listPeriodLeaves(
    periodId: number,
    params: Pick<
      LeaveManagementPeriodQuery,
      | "leave_type"
      | "profession_code"
      | "pending_report"
      | "search"
      | "limit"
      | "offset"
      | "sort_by"
      | "sort_dir"
    >,
  ) {
    const { startDate, endDate } = await resolvePeriodRange(periodId);
    const citizenIds = await resolvePayrollCitizenIds(periodId);
    if (citizenIds.length === 0) {
      return {
        items: [],
        total: 0,
        limit: params.limit ?? null,
        offset: params.offset ?? 0,
        period_start: startDate,
        period_end: endDate,
      };
    }
    const leaveRepository = new LeaveManagementRepository();
    const [items, total] = await Promise.all([
      leaveRepository.listLeaveManagementByPeriod({
        ...params,
        citizen_ids: citizenIds,
        start_date: startDate,
        end_date: endDate,
      }),
      leaveRepository.countLeaveManagementByPeriod({
        ...params,
        citizen_ids: citizenIds,
        start_date: startDate,
        end_date: endDate,
      }),
    ]);
    return {
      items,
      total,
      limit: params.limit ?? null,
      offset: params.offset ?? 0,
      period_start: startDate,
      period_end: endDate,
    };
  }

  static async summarizePeriodLeavesByProfession(
    periodId: number,
    params: Pick<
      LeaveManagementPeriodQuery,
      "leave_type" | "pending_report" | "search"
    >,
  ) {
    const { startDate, endDate } = await resolvePeriodRange(periodId);
    const citizenIds = await resolvePayrollCitizenIds(periodId);
    if (citizenIds.length === 0) {
      return [];
    }
    const leaveRepository = new LeaveManagementRepository();
    return leaveRepository.summarizeLeaveManagementByProfessionByPeriod({
      ...params,
      citizen_ids: citizenIds,
      start_date: startDate,
      end_date: endDate,
    });
  }
}
