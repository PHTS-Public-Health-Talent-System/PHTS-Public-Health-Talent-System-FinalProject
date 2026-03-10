export const buildSyncExecutionStats = () => ({
  users: { added: 0, updated: 0, skipped: 0 },
  employees: { upserted: 0, skipped: 0 },
  support_employees: { upserted: 0, skipped: 0 },
  support_cleanup: { candidates: 0, deleted: 0, dry_run: false },
  signatures: { added: 0, skipped: 0 },
  licenses: { upserted: 0 },
  quotas: { upserted: 0 },
  leaves: { upserted: 0, skipped: 0 },
  movements: { added: 0 },
  roles: { updated: 0, skipped: 0, missing: 0 },
  quality_gates: { status_code_total: 0, status_code_null: 0, threshold_pct: 0 },
});

export const buildSyncExecutionConnection = () => {
  const query = jest.fn(async (sql: string) => {
    const statement = String(sql);

    if (statement.includes('FROM users WHERE id = ?')) {
      return [[{ id: 42, citizen_id: '1234567890123', role: 'USER' }]];
    }
    if (statement.includes('FROM users WHERE citizen_id = ? LIMIT 1')) {
      return [[{ id: 42, citizen_id: '1234567890123', role: 'USER' }]];
    }
    if (statement.includes('support_view_count')) {
      return [[{ support_view_count: 0, support_table_count: 0 }]];
    }
    if (statement.includes('users_total')) {
      return [[{ users_total: 1, users_active: 1, users_inactive: 0 }]];
    }
    if (statement.includes('profile_status_code_null')) {
      return [[{ profile_status_code_null: 0, support_status_code_null: 0 }]];
    }
    return [[]];
  });

  return {
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    query,
    execute: jest.fn(),
  };
};
