import type { Role } from '@/types/auth';

export const ROLE_OPTIONS: Role[] = [
  'USER',
  'HEAD_SCOPE',
  'PTS_OFFICER',
  'HEAD_HR',
  'HEAD_FINANCE',
  'FINANCE_OFFICER',
  'DIRECTOR',
  'ADMIN',
];

export const FRONTEND_HEAD_SCOPE_LABEL = 'หัวหน้างาน';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  USER: 'ผู้ใช้งานทั่วไป',
  HEAD_SCOPE: FRONTEND_HEAD_SCOPE_LABEL,
  PTS_OFFICER: 'เจ้าหน้าที่ พ.ต.ส.',
  HEAD_HR: 'หัวหน้างานบุคคล',
  HEAD_FINANCE: 'หัวหน้าการเงิน',
  FINANCE_OFFICER: 'เจ้าหน้าที่การเงิน',
  DIRECTOR: 'ผู้อำนวยการ',
};

export const getRoleLabel = (roleCode: string): string => {
  if (roleCode in ROLE_LABELS) {
    return ROLE_LABELS[roleCode as Role];
  }
  return roleCode;
};

export const isHeadScopeRole = (roleCode: string): roleCode is 'HEAD_SCOPE' =>
  roleCode === 'HEAD_SCOPE';

export const FRONTEND_HEAD_SCOPE_BASE_PATH = '/head-scope';
