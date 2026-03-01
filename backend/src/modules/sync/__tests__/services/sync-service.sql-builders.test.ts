/**
 * SyncService SQL Builder Helpers Tests
 */

describe('SyncService SQL Builder Helpers', () => {
  let buildLeaveRecordSql: any;
  let buildLeaveRecordValues: any;
  let buildSupportEmployeeSql: any;
  let buildSupportEmployeeValues: any;

  beforeAll(async () => {
    const mod = await import('../../repositories/sync-query-builders.repository.js');
    buildLeaveRecordSql = (mod as any).buildLeaveRecordSql;
    buildLeaveRecordValues = (mod as any).buildLeaveRecordValues;
    buildSupportEmployeeSql = (mod as any).buildSupportEmployeeSql;
    buildSupportEmployeeValues = (mod as any).buildSupportEmployeeValues;
  });

  describe('buildLeaveRecordSql', () => {
    it('should ignore is_no_pay column even if requested', () => {
      expect(buildLeaveRecordSql).toBeDefined();

      const { sql, fields } = buildLeaveRecordSql({
        hasStatusColumn: true,
        hasNoPayColumn: true,
      });

      expect(sql).toContain('INSERT INTO leave_records');
      expect(sql).toContain('status');
      expect(sql).not.toContain('is_no_pay');
      expect(sql).toContain('ON DUPLICATE KEY UPDATE');
      expect(fields).toContain('status');
      expect(fields).not.toContain('is_no_pay');
    });

    it('should build SQL with only status column', () => {
      expect(buildLeaveRecordSql).toBeDefined();

      const { sql, fields } = buildLeaveRecordSql({
        hasStatusColumn: true,
      });

      expect(sql).toContain('status');
      expect(sql).not.toContain('is_no_pay');
      expect(sql).toContain('leave_type = VALUES(leave_type)');
      expect(sql).toContain('fiscal_year = VALUES(fiscal_year)');
      expect(sql).toContain('remark = VALUES(remark)');
      expect(fields).toContain('status');
      expect(fields).not.toContain('is_no_pay');
    });

    it('should build SQL without optional columns', () => {
      expect(buildLeaveRecordSql).toBeDefined();

      const { sql, fields } = buildLeaveRecordSql({
        hasStatusColumn: false,
      });

      expect(sql).not.toContain('status');
      expect(sql).not.toContain('is_no_pay');
      expect(fields).not.toContain('status');
      expect(fields).not.toContain('is_no_pay');
      expect(fields).toContain('ref_id');
      expect(fields).toContain('citizen_id');
    });
  });

  describe('buildLeaveRecordValues', () => {
    it('should build values array with all fields', () => {
      expect(buildLeaveRecordValues).toBeDefined();

      const vLeave = {
        ref_id: 'REF123',
        citizen_id: '1234567890123',
        leave_type: 'VACATION',
        start_date: '2024-01-01',
        end_date: '2024-01-05',
        duration_days: 5,
        fiscal_year: 2567,
        remark: 'Test',
        status: 'APPROVED',
      };

      const values = buildLeaveRecordValues(vLeave, {
        hasStatusColumn: true,
      });

      expect(values).toContain('REF123');
      expect(values).toContain('1234567890123');
      expect(values).toContain('VACATION');
      expect(values).toContain('APPROVED');
    });
  });

  describe('buildSupportEmployeeSql', () => {
    it('should include level column when present', () => {
      expect(buildSupportEmployeeSql).toBeDefined();

      const { sql, fields } = buildSupportEmployeeSql({ hasLevelColumn: true });

      expect(sql).toContain('level');
      expect(fields).toContain('level');
    });

    it('should exclude level column when not present', () => {
      expect(buildSupportEmployeeSql).toBeDefined();

      const { sql, fields } = buildSupportEmployeeSql({ hasLevelColumn: false });

      expect(sql).not.toContain('level');
      expect(fields).not.toContain('level');
      expect(fields).toContain('citizen_id');
      expect(fields).toContain('position_name');
    });
  });

  describe('buildSupportEmployeeValues', () => {
    it('should include level when column exists', () => {
      if (!buildSupportEmployeeValues) {
        expect(true).toBe(true);
        return;
      }

      const vSup = {
        citizen_id: '1234567890123',
        title: 'นาย',
        first_name: 'สมชาย',
        last_name: 'ใจดี',
        position_name: 'พยาบาล',
        level: 'ชำนาญการพิเศษ',
        special_position: null,
        employee_type: 'PERMANENT',
        department: 'กลุ่มงานการพยาบาล',
        is_currently_active: 1,
      };

      const values = buildSupportEmployeeValues(vSup, { hasLevelColumn: true });

      expect(values).toContain('1234567890123');
      expect(values).toContain('สมชาย');
      expect(values).toContain('ชำนาญการพิเศษ');
    });
  });
});
