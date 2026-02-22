import { UserRole } from "@/types/auth.js";
import type { RequestWithDetails } from "@/modules/request/contracts/request.types.js";
import { requestQueryService } from "@/modules/request/read/services/query.service.js";
import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository.js";
import { PeriodStatus } from "@/modules/payroll/entities/payroll.entity.js";
import { FinanceRepository } from "@/modules/finance/repositories/finance.repository.js";

const isPendingStatus = (status?: string | null) =>
  status?.startsWith("PENDING") ?? false;

const countPendingForUser = (requests: RequestWithDetails[]) =>
  requests.filter((req) => isPendingStatus(req.status)).length;

const resolvePayrollStatus = (role: UserRole): PeriodStatus | null => {
  switch (role) {
    case UserRole.HEAD_HR:
      return PeriodStatus.WAITING_HR;
    case UserRole.HEAD_FINANCE:
      return PeriodStatus.WAITING_HEAD_FINANCE;
    case UserRole.DIRECTOR:
      return PeriodStatus.WAITING_DIRECTOR;
    case UserRole.PTS_OFFICER:
      return PeriodStatus.OPEN;
    case UserRole.FINANCE_OFFICER:
      return PeriodStatus.WAITING_HEAD_FINANCE;
    default:
      return null;
  }
};

export const getPendingRequestCount = async (params: {
  role: UserRole;
  userId: number;
}): Promise<number> => {
  const { role, userId } = params;
  if (role === UserRole.USER) {
    const myRequests = await requestQueryService.getMyRequests(userId);
    return countPendingForUser(myRequests);
  }

  if (
    role === UserRole.HEAD_WARD ||
    role === UserRole.HEAD_DEPT ||
    role === UserRole.PTS_OFFICER ||
    role === UserRole.HEAD_HR ||
    role === UserRole.HEAD_FINANCE ||
    role === UserRole.DIRECTOR
  ) {
    const pendingForApprover = await requestQueryService.getPendingForApprover(
      role,
      userId,
    );
    return pendingForApprover.length;
  }

  return 0;
};

export const getPendingPayrollCount = async (role: UserRole): Promise<number> => {
  if (role === UserRole.FINANCE_OFFICER) {
    const financeSummary = await FinanceRepository.findFinanceSummary(
      undefined,
      undefined,
      true,
    );
    return financeSummary.filter((period) => {
      const pendingCount = Number(period.pending_count ?? 0);
      const pendingAmount = Number(period.pending_amount ?? 0);
      return pendingCount > 0 || pendingAmount > 0;
    }).length;
  }

  const payrollStatus = resolvePayrollStatus(role);
  if (!payrollStatus) return 0;

  const periods = await PayrollRepository.findPeriodsByStatus(payrollStatus, 50);
  return periods.length;
};

export const getPendingPayrollStatusForApprover = (
  role: UserRole,
): PeriodStatus => {
  if (role === UserRole.HEAD_FINANCE) return PeriodStatus.WAITING_HEAD_FINANCE;
  return PeriodStatus.WAITING_HR;
};
