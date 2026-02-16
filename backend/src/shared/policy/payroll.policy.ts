import { UserRole } from '@/types/auth.js';
import { PeriodStatus } from '@/modules/payroll/entities/payroll.entity.js';

export type PayrollAction =
  | "SUBMIT"
  | "APPROVE_HR"
  | "APPROVE_HEAD_FINANCE"
  | "APPROVE_DIRECTOR"
  | "REJECT";

const TRANSITIONS: Record<
  PayrollAction,
  Partial<Record<PeriodStatus, PeriodStatus>>
> = {
  SUBMIT: {
    [PeriodStatus.OPEN]: PeriodStatus.WAITING_HR,
  },
  APPROVE_HR: {
    [PeriodStatus.WAITING_HR]: PeriodStatus.WAITING_HEAD_FINANCE,
  },
  APPROVE_HEAD_FINANCE: {
    [PeriodStatus.WAITING_HEAD_FINANCE]: PeriodStatus.WAITING_DIRECTOR,
  },
  APPROVE_DIRECTOR: {
    [PeriodStatus.WAITING_DIRECTOR]: PeriodStatus.CLOSED,
  },
  REJECT: {
    [PeriodStatus.WAITING_HR]: PeriodStatus.OPEN,
    [PeriodStatus.WAITING_HEAD_FINANCE]: PeriodStatus.OPEN,
    [PeriodStatus.WAITING_DIRECTOR]: PeriodStatus.OPEN,
  },
};

const ROLE_RULES: Record<PayrollAction, UserRole[]> = {
  SUBMIT: [UserRole.PTS_OFFICER],
  APPROVE_HR: [UserRole.HEAD_HR],
  APPROVE_HEAD_FINANCE: [UserRole.HEAD_FINANCE],
  APPROVE_DIRECTOR: [UserRole.DIRECTOR],
  REJECT: [UserRole.HEAD_HR, UserRole.DIRECTOR],
};

export function resolveNextStatus(
  action: PayrollAction,
  currentStatus: PeriodStatus,
): PeriodStatus {
  const next = TRANSITIONS[action]?.[currentStatus];
  if (!next) {
    throw new Error(
      `Invalid action '${action}' for status '${currentStatus}'`,
    );
  }
  return next;
}

export function canTransition(
  role: UserRole,
  action: PayrollAction,
  currentStatus: PeriodStatus,
): boolean {
  const allowedRoles = ROLE_RULES[action] || [];
  if (!allowedRoles.includes(role)) return false;
  const next = TRANSITIONS[action]?.[currentStatus];
  return Boolean(next);
}
