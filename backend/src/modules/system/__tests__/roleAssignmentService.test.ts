import { RoleAssignmentService } from '../services/roleAssignmentService.js';

describe('RoleAssignmentService.deriveRole', () => {
  test('prioritizes DIRECTOR over finance/head roles', () => {
    const role = RoleAssignmentService.deriveRole({
      citizen_id: '1',
      position_name: 'ผู้อำนวยการ',
      special_position: 'หัวหน้ากลุ่มงานการเงิน',
      department: 'กลุ่มงานการเงิน',
    });
    expect(role).toBe('DIRECTOR');
  });

  test('assigns HEAD_FINANCE for finance head (non-accounting)', () => {
    const role = RoleAssignmentService.deriveRole({
      citizen_id: '2',
      special_position: 'หัวหน้ากลุ่มงาน-การเงิน',
      department: 'กลุ่มงานการเงิน',
    });
    expect(role).toBe('HEAD_FINANCE');
  });

  test('keeps HR department as USER even if head', () => {
    const role = RoleAssignmentService.deriveRole({
      citizen_id: '3',
      special_position: 'หัวหน้ากลุ่มงาน-ทรัพยากรบุคคล',
      department: 'กลุ่มงานทรัพยากรบุคคล',
    });
    expect(role).toBe('USER');
  });

  test('assistant head does not get head role', () => {
    const role = RoleAssignmentService.deriveRole({
      citizen_id: '4',
      special_position: 'ผู้ช่วยหัวหน้าตึก-ศัลยกรรม',
      department: 'กลุ่มงานศัลยกรรม',
    });
    expect(role).toBe('USER');
  });

  test('assigns HEAD_DEPT when special position indicates head dept', () => {
    const role = RoleAssignmentService.deriveRole({
      citizen_id: '5',
      special_position: 'หัวหน้ากลุ่มงาน-อายุรกรรม',
      department: 'กลุ่มงานอายุรกรรม',
    });
    expect(role).toBe('HEAD_DEPT');
  });

  test('assigns HEAD_WARD when special position indicates head ward', () => {
    const role = RoleAssignmentService.deriveRole({
      citizen_id: '6',
      special_position: 'หัวหน้าตึก-ศัลยกรรม',
      department: 'กลุ่มงานศัลยกรรม',
    });
    expect(role).toBe('HEAD_WARD');
  });
});
