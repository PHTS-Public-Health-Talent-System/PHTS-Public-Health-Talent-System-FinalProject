import { SystemRepository } from '@/modules/system/repositories/system.repository.js';
import db from '@config/database.js';

jest.mock('@config/database.js', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    execute: jest.fn(),
  },
  getConnection: jest.fn(),
  query: jest.fn(),
}));

describe('SystemRepository backup jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides backup job repository methods', () => {
    const repo: any = SystemRepository;
    expect(typeof repo.createBackupJob).toBe('function');
    expect(typeof repo.finishBackupJob).toBe('function');
    expect(typeof repo.getBackupHistory).toBe('function');
  });

  it('caps backup history limit to 100', async () => {
    const mockQuery = db.query as jest.Mock;
    mockQuery.mockResolvedValue([[]]);

    const repo: any = SystemRepository;
    await repo.getBackupHistory(1000);

    expect(mockQuery).toHaveBeenCalled();
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('LIMIT 100');
  });
});

