import { UserRole } from '@/types/auth.js';
import { PeriodStatus } from '@/modules/payroll/entities/payroll.entity.js';
import {
  resolveNextStatus,
  canTransition,
} from '@shared/policy/payroll.policy.js';

describe("payroll.policy", () => {
  test("resolveNextStatus returns next status for valid transitions", () => {
    expect(
      resolveNextStatus("SUBMIT", PeriodStatus.OPEN),
    ).toBe(PeriodStatus.WAITING_HR);

    expect(
      resolveNextStatus("APPROVE_HR", PeriodStatus.WAITING_HR),
    ).toBe(PeriodStatus.WAITING_HEAD_FINANCE);

    expect(
      resolveNextStatus(
        "APPROVE_HEAD_FINANCE",
        PeriodStatus.WAITING_HEAD_FINANCE,
      ),
    ).toBe(PeriodStatus.WAITING_DIRECTOR);

    expect(
      resolveNextStatus(
        "APPROVE_DIRECTOR",
        PeriodStatus.WAITING_DIRECTOR,
      ),
    ).toBe(PeriodStatus.CLOSED);
  });

  test("resolveNextStatus handles reject transitions", () => {
    expect(
      resolveNextStatus("REJECT", PeriodStatus.WAITING_HR),
    ).toBe(PeriodStatus.OPEN);
    expect(
      resolveNextStatus("REJECT", PeriodStatus.WAITING_HEAD_FINANCE),
    ).toBe(PeriodStatus.OPEN);
    expect(
      resolveNextStatus("REJECT", PeriodStatus.WAITING_DIRECTOR),
    ).toBe(PeriodStatus.OPEN);
  });

  test("resolveNextStatus throws on invalid transitions", () => {
    expect(() =>
      resolveNextStatus("SUBMIT", PeriodStatus.CLOSED),
    ).toThrow("Invalid action");
  });

  test("canTransition checks role + status", () => {
    expect(
      canTransition(UserRole.PTS_OFFICER, "SUBMIT", PeriodStatus.OPEN),
    ).toBe(true);
    expect(
      canTransition(UserRole.HEAD_HR, "SUBMIT", PeriodStatus.OPEN),
    ).toBe(false);

    expect(
      canTransition(
        UserRole.HEAD_FINANCE,
        "APPROVE_HEAD_FINANCE",
        PeriodStatus.WAITING_HEAD_FINANCE,
      ),
    ).toBe(true);
    expect(
      canTransition(
        UserRole.HEAD_FINANCE,
        "APPROVE_HEAD_FINANCE",
        PeriodStatus.OPEN,
      ),
    ).toBe(false);
  });
});
