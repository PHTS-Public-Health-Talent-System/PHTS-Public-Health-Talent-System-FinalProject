import { UserRole } from '@/types/auth.js';
import {
  STEP_ROLE_MAP,
  ROLE_STEP_MAP,
  TOTAL_APPROVAL_STEPS,
  getRoleForStep,
  getStepForRole,
  canApproveAtStep,
  canBatchApprove,
  canReassign,
  canAdjustLeave,
  canViewScopes,
} from '@shared/policy/request.policy.js';

describe("request.policy", () => {
  test("role-step maps are consistent for approval roles", () => {
    expect(TOTAL_APPROVAL_STEPS).toBe(6);
    Object.entries(STEP_ROLE_MAP).forEach(([step, role]) => {
      const stepNo = Number(step);
      expect(ROLE_STEP_MAP[role]).toBe(stepNo);
    });
  });

  test("getRoleForStep returns expected role", () => {
    expect(getRoleForStep(1)).toBe(UserRole.HEAD_WARD);
    expect(getRoleForStep(3)).toBe(UserRole.PTS_OFFICER);
    expect(getRoleForStep(6)).toBe(UserRole.DIRECTOR);
  });

  test("getStepForRole returns undefined for non-approval roles", () => {
    expect(getStepForRole(UserRole.ADMIN)).toBeUndefined();
    expect(getStepForRole(UserRole.USER)).toBeUndefined();
    expect(getStepForRole(UserRole.FINANCE_OFFICER)).toBeUndefined();
  });

  test("canApproveAtStep only true for matching role + step", () => {
    expect(canApproveAtStep(UserRole.HEAD_DEPT, 2)).toBe(true);
    expect(canApproveAtStep(UserRole.HEAD_DEPT, 3)).toBe(false);
  });

  test("batch approve only allowed for director", () => {
    expect(canBatchApprove(UserRole.DIRECTOR)).toBe(true);
    expect(canBatchApprove(UserRole.PTS_OFFICER)).toBe(false);
  });

  test("reassign/adjust leave only allowed for PTS_OFFICER", () => {
    expect(canReassign(UserRole.PTS_OFFICER)).toBe(true);
    expect(canReassign(UserRole.HEAD_HR)).toBe(false);
    expect(canAdjustLeave(UserRole.PTS_OFFICER)).toBe(true);
    expect(canAdjustLeave(UserRole.HEAD_HR)).toBe(false);
  });

  test("scope visibility only for head-ward/head-dept", () => {
    expect(canViewScopes(UserRole.HEAD_WARD)).toBe(true);
    expect(canViewScopes(UserRole.HEAD_DEPT)).toBe(true);
    expect(canViewScopes(UserRole.PTS_OFFICER)).toBe(false);
  });
});
