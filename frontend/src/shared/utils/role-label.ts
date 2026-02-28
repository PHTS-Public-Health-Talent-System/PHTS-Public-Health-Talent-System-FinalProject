import type { Role } from '@/types/auth';

export const ROLE_OPTIONS: Role[] = [
  'USER',
  'HEAD_WARD',
  'HEAD_DEPT',
  'PTS_OFFICER',
  'HEAD_HR',
  'HEAD_FINANCE',
  'FINANCE_OFFICER',
  'DIRECTOR',
  'ADMIN',
];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  USER: 'ผู้ใช้งานทั่วไป',
  PTS_OFFICER: 'เจ้าหน้าที่ พ.ต.ส.',
  HEAD_WARD: 'หัวหน้าตึก/หัวหน้างาน',
  HEAD_DEPT: 'หัวหน้ากลุ่มงาน',
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
