import { UserRole } from '@/types/auth.js';

export { UserRole };

export const APPROVER_ROLES: UserRole[] = [
  UserRole.HEAD_WARD,
  UserRole.HEAD_DEPT,
  UserRole.PTS_OFFICER,
  UserRole.HEAD_HR,
  UserRole.HEAD_FINANCE,
  UserRole.DIRECTOR,
];

export function isApproverRole(role: UserRole): boolean {
  return APPROVER_ROLES.includes(role);
}

export function isAdminRole(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}
