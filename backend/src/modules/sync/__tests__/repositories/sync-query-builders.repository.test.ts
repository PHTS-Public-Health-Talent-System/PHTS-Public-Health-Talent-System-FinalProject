const loadModule = async () => import('../../repositories/sync-query-builders.repository.js');

describe('sync query builders repository', () => {
  test('exposes explicit employee and support column lists', async () => {
    const mod = await loadModule();

    expect((mod as any).VIEW_EMPLOYEE_COLUMNS).toEqual([
      'citizen_id',
      'title',
      'first_name',
      'last_name',
      'sex',
      'birth_date',
      'position_name',
      'position_number',
      'level',
      'special_position',
      'employee_type',
      'start_current_position',
      'first_entry_date',
      'mission_group',
      'department',
      'sub_department',
      'specialist',
      'expert',
      'original_status',
      'is_currently_active',
    ]);

    expect((mod as any).VIEW_SUPPORT_COLUMNS).toEqual([
      'citizen_id',
      'title',
      'first_name',
      'last_name',
      'sex',
      'position_name',
      'position_number',
      'level',
      'special_position',
      'employee_type',
      'start_current_position',
      'first_entry_date',
      'mission_group',
      'department',
      'original_status',
      'is_currently_active',
    ]);
  });

  test('builds binary collation helpers for citizen_id joins and filters', async () => {
    const mod = await loadModule();

    expect((mod as any).citizenIdJoinBinary('m', 'u')).toBe(
      'CAST(m.citizen_id AS BINARY) = CAST(u.citizen_id AS BINARY)',
    );
    expect((mod as any).citizenIdWhereBinary('m', '?')).toBe(
      'CAST(m.citizen_id AS BINARY) = CAST(? AS BINARY)',
    );
  });

  test('keeps view queries scoped to HRMS/profile sources without users joins', async () => {
    const mod = await loadModule();

    const quotasSql = (mod as any).buildQuotasViewQuery();
    expect(quotasSql).toContain('FROM hrms_databases.setdays');
    expect(quotasSql).toContain('JOIN emp_profiles');
    expect(quotasSql).not.toContain('JOIN users');

    const leavesSql = (mod as any).buildLeaveViewQuery();
    expect(leavesSql).toContain('FROM hrms_databases.data_leave');
    expect(leavesSql).toContain('FROM hrms_databases.tb_meeting');
    expect(leavesSql).not.toContain('JOIN users');

    const signaturesSql = (mod as any).buildSignaturesViewQuery();
    expect(signaturesSql).toContain('FROM hrms_databases.signature');
    expect(signaturesSql).toContain('citizen_id');
    expect(signaturesSql).not.toContain('JOIN users');
  });
});
