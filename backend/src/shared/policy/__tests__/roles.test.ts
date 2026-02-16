import { UserRole } from '@/types/auth.js';
import { APPROVER_ROLES, isApproverRole, isAdminRole } from '@shared/policy/roles.js';

describe("roles policy", () => {
  test("approver roles contain expected roles", () => {
    expect(APPROVER_ROLES).toContain(UserRole.HEAD_WARD);
    expect(APPROVER_ROLES).toContain(UserRole.HEAD_DEPT);
    expect(APPROVER_ROLES).toContain(UserRole.PTS_OFFICER);
    expect(APPROVER_ROLES).toContain(UserRole.HEAD_HR);
    expect(APPROVER_ROLES).toContain(UserRole.HEAD_FINANCE);
    expect(APPROVER_ROLES).toContain(UserRole.DIRECTOR);
  });

  test("isApproverRole matches list", () => {
    expect(isApproverRole(UserRole.PTS_OFFICER)).toBe(true);
    expect(isApproverRole(UserRole.ADMIN)).toBe(false);
  });

  test("isAdminRole only true for admin", () => {
    expect(isAdminRole(UserRole.ADMIN)).toBe(true);
    expect(isAdminRole(UserRole.PTS_OFFICER)).toBe(false);
  });
});
