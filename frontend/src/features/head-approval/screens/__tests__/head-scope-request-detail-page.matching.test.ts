import { filterMatchedScopesForActingRole } from '@/features/head-approval/screens/head-scope-request-detail-page';

describe('filterMatchedScopesForActingRole', () => {
  test('matches dept scope for WARD_SCOPE even when request has sub_department', () => {
    const scopes = [
      { type: 'DEPT' as const, label: 'กลุ่มงานเภสัชกรรม', value: 'กลุ่มงานเภสัชกรรม' },
      { type: 'UNIT' as const, label: 'ห้องจ่ายยาผู้ป่วยนอก', value: 'ห้องจ่ายยาผู้ป่วยนอก' },
    ];

    const matched = filterMatchedScopesForActingRole(
      scopes,
      'WARD_SCOPE',
      'กลุ่มงานเภสัชกรรม',
      'งานบริบาลเภสัชกรรม',
    );

    expect(matched).toEqual([
      { type: 'DEPT', label: 'กลุ่มงานเภสัชกรรม', value: 'กลุ่มงานเภสัชกรรม' },
    ]);
  });
});
