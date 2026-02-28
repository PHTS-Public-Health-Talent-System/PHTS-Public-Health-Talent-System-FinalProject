jest.mock('@/modules/notification/services/notification.service.js', () => ({
  NotificationService: {
    notifyUserByTemplate: jest.fn(),
  },
}));

jest.mock('@/modules/workforce-compliance/repositories/alert-logs.repository.js', () => ({
  AlertLogsRepository: {
    findLatestLicenseLogsByReferenceIds: jest.fn(),
    hasPayloadHash: jest.fn(),
    insertLog: jest.fn(),
  },
}));

jest.mock('@/modules/workforce-compliance/repositories/workforce-compliance.repository.js', () => ({
  WorkforceComplianceRepository: {
    findUserIdByCitizenId: jest.fn(),
  },
}));

jest.mock('@/modules/workforce-compliance/repositories/license-compliance.repository.js', () => ({
  LicenseComplianceRepository: {
    getSummary: jest.fn(),
    getListByBucket: jest.fn(),
  },
}));

import { notifyLicenseAlerts } from '@/modules/workforce-compliance/services/license-compliance.service.js';
import { AlertLogsRepository } from '@/modules/workforce-compliance/repositories/alert-logs.repository.js';
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';

describe('notifyLicenseAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses ops timezone when building daily dedupe key', async () => {
    (AlertLogsRepository.hasPayloadHash as jest.Mock).mockResolvedValue(false);
    (AlertLogsRepository.insertLog as jest.Mock).mockResolvedValue(1);
    (WorkforceComplianceRepository.findUserIdByCitizenId as jest.Mock).mockResolvedValue(44);

    const result = await notifyLicenseAlerts(
      [{ citizen_id: '1234567890123', bucket: 'expired' }],
      new Date('2026-02-28T17:30:00.000Z'),
    );

    const expectedHash = crypto
      .createHash('sha256')
      .update('LICENSE_EXPIRING:citizen:1234567890123:expired:2026-03-01')
      .digest('hex');

    expect(AlertLogsRepository.insertLog).toHaveBeenCalledWith(
      expect.objectContaining({
        payload_hash: expectedHash,
        reference_id: '1234567890123:expired',
      }),
    );

    const hasPayloadHashArg = (AlertLogsRepository.hasPayloadHash as jest.Mock).mock.calls[0]?.[0];
    expect(hasPayloadHashArg).toBe(expectedHash);
    expect(result).toEqual({ sent: 1, skipped: 0 });
  });
});
import crypto from 'node:crypto';
