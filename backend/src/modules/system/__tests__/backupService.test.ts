/**
 * Backup Service Tests
 *
 * Note: This test file validates configuration scenarios.
 * The actual backup execution would require mocking execFile from node:child_process.
 */

describe('Backup Service Configuration', () => {
  it('validates backup service can be imported', async () => {
    const { runBackupJob } = await import('@/modules/system/services/backupService.js');
    expect(runBackupJob).toBeDefined();
    expect(typeof runBackupJob).toBe('function');
  });

  it('returns disabled when BACKUP_ENABLED is not set', async () => {
    const originalEnv = process.env.BACKUP_ENABLED;
    delete process.env.BACKUP_ENABLED;
    
    jest.resetModules();
    const { runBackupJob } = await import('@/modules/system/services/backupService.js');
    const result = await runBackupJob();
    
    expect(result.enabled).toBe(false);
    expect(result.output).toBeUndefined();
    
    if (originalEnv !== undefined) {
      process.env.BACKUP_ENABLED = originalEnv;
    }
  });

  // Security validation tests would require proper environment setup
  // and are better suited for integration tests
});
