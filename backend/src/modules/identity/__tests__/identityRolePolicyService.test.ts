import { IdentityRolePolicyService } from '@/modules/identity/services/identity-role-policy.service.js';
import { UserRole } from '@/types/auth.js';

describe('IdentityRolePolicyService role taxonomy', () => {
  test('exposes complete system role sets with expected policy groups', () => {
    expect(IdentityRolePolicyService.ALL_SYSTEM_ROLES).toEqual([
      UserRole.USER,
      UserRole.HEAD_WARD,
      UserRole.HEAD_DEPT,
      UserRole.PTS_OFFICER,
      UserRole.HEAD_HR,
      UserRole.HEAD_FINANCE,
      UserRole.FINANCE_OFFICER,
      UserRole.DIRECTOR,
      UserRole.ADMIN,
    ]);
    expect([...IdentityRolePolicyService.HR_MANAGED_ROLES]).toEqual([
      UserRole.HEAD_WARD,
      UserRole.HEAD_DEPT,
    ]);
    expect([...IdentityRolePolicyService.PROTECTED_ROLES]).toEqual([
      UserRole.ADMIN,
      UserRole.PTS_OFFICER,
    ]);
    expect(IdentityRolePolicyService.MANUAL_ASSIGNABLE_ROLES.has(UserRole.DIRECTOR)).toBe(true);
    expect(IdentityRolePolicyService.MANUAL_ASSIGNABLE_ROLES.has(UserRole.HEAD_WARD)).toBe(false);
  });
});

describe('IdentityRolePolicyService.deriveRole', () => {
  test('assigns HEAD_DEPT when special_position indicates dept head', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '1',
      position_name: 'ผู้อำนวยการ',
      special_position: 'หัวหน้ากลุ่มงานการเงิน',
      department: 'กลุ่มงานการเงิน',
    });
    expect(role).toBe('HEAD_DEPT');
  });

  test('assigns HEAD_DEPT for finance head (non-assistant)', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '2',
      special_position: 'หัวหน้ากลุ่มงาน-การเงิน',
      department: 'กลุ่มงานการเงิน',
    });
    expect(role).toBe('HEAD_DEPT');
  });

  test('assigns HEAD_DEPT for HR head when pattern matches', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '3',
      special_position: 'หัวหน้ากลุ่มงาน-ทรัพยากรบุคคล',
      department: 'กลุ่มงานทรัพยากรบุคคล',
    });
    expect(role).toBe('HEAD_DEPT');
  });

  test('assistant head does not get head role', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '4',
      special_position: 'ผู้ช่วยหัวหน้าตึก-ศัลยกรรม',
      department: 'กลุ่มงานศัลยกรรม',
    });
    expect(role).toBe('USER');
  });

  test('assigns HEAD_DEPT when special position indicates head dept', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '5',
      special_position: 'หัวหน้ากลุ่มงาน-อายุรกรรม',
      department: 'กลุ่มงานอายุรกรรม',
    });
    expect(role).toBe('HEAD_DEPT');
  });

  test('assigns HEAD_WARD when special position indicates head ward', () => {
    const role = IdentityRolePolicyService.deriveRole({
      citizen_id: '6',
      special_position: 'หัวหน้าตึก-ศัลยกรรม',
      department: 'กลุ่มงานศัลยกรรม',
    });
    expect(role).toBe('HEAD_WARD');
  });
});
