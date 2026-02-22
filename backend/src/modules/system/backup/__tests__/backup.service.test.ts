/**
 * Backup Service Tests
 */

jest.mock('@/modules/system/repositories/system.repository.js', () => ({
  SystemRepository: {
    createBackupJob: jest.fn().mockResolvedValue(99),
    finishBackupJob: jest.fn().mockResolvedValue(undefined),
    ensureBackupJobsTable: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@config/redis.js', () => ({
  __esModule: true,
  default: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(''),
    del: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('node:child_process', () => ({
  execFile: jest.fn((cmd, args, opts, cb) =>
    cb(null, { stdout: 'Backup written to /tmp/phts.sql.gz', stderr: '' }),
  ),
}));

jest.mock('node:fs/promises', () => ({
  stat: jest.fn().mockResolvedValue({ size: 1024 }),
}));

describe('Backup Service Configuration', () => {
  it('validates backup service can be imported', async () => {
    const { runBackupJob } = await import('@/modules/system/backup/services/backup.service.js');
    expect(runBackupJob).toBeDefined();
    expect(typeof runBackupJob).toBe('function');
  });

  it('returns disabled when BACKUP_ENABLED is not set', async () => {
    const originalEnv = process.env.BACKUP_ENABLED;
    delete process.env.BACKUP_ENABLED;

    jest.resetModules();
    const { runBackupJob } = await import('@/modules/system/backup/services/backup.service.js');
    const result = await runBackupJob();

    expect(result.enabled).toBe(false);
    expect(result.output).toBeUndefined();

    if (originalEnv !== undefined) {
      process.env.BACKUP_ENABLED = originalEnv;
    }
  });

  it('returns jobId when backup runs successfully', async () => {
    const oldEnabled = process.env.BACKUP_ENABLED;
    const oldCmd = process.env.BACKUP_COMMAND;
    const oldArgs = process.env.BACKUP_ARGS;
    const oldWorkdir = process.env.BACKUP_WORKDIR;

    process.env.BACKUP_ENABLED = 'true';
    process.env.BACKUP_COMMAND = '/usr/bin/true';
    process.env.BACKUP_ARGS = '[]';
    process.env.BACKUP_WORKDIR = '/tmp';

    jest.resetModules();
    const { runBackupJob } = await import('@/modules/system/backup/services/backup.service.js');
    const result = await runBackupJob();

    expect(result.enabled).toBe(true);
    expect(result.jobId).toBeDefined();

    if (oldEnabled !== undefined) process.env.BACKUP_ENABLED = oldEnabled;
    else delete process.env.BACKUP_ENABLED;
    if (oldCmd !== undefined) process.env.BACKUP_COMMAND = oldCmd;
    else delete process.env.BACKUP_COMMAND;
    if (oldArgs !== undefined) process.env.BACKUP_ARGS = oldArgs;
    else delete process.env.BACKUP_ARGS;
    if (oldWorkdir !== undefined) process.env.BACKUP_WORKDIR = oldWorkdir;
    else delete process.env.BACKUP_WORKDIR;
  });
});
