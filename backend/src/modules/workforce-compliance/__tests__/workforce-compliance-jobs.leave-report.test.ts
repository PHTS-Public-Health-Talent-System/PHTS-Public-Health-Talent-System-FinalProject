jest.mock('@/modules/notification/services/notification.service.js', () => ({
  NotificationService: {
    notifyUser: jest.fn(),
    notifyRole: jest.fn(),
    notifyUserByTemplate: jest.fn(),
    notifyRoleByTemplate: jest.fn(),
  },
}));

jest.mock('@/modules/workforce-compliance/repositories/alert-logs.repository.js', () => ({
  AlertLogsRepository: {
    hasPayloadHash: jest.fn(),
    insertLog: jest.fn(),
  },
}));

jest.mock('@/modules/workforce-compliance/repositories/workforce-compliance.repository.js', () => ({
  WorkforceComplianceRepository: {
    getLeaveReportCandidates: jest.fn(),
    findUserIdByCitizenId: jest.fn(),
    getRetirementsDue: jest.fn(),
    getMovementOutCandidates: jest.fn(),
    setEligibilityExpiry: jest.fn(),
    restoreLatestEligibility: jest.fn(),
  },
}));

jest.mock('@/modules/workforce-compliance/repositories/license-compliance.repository.js', () => ({
  LicenseComplianceRepository: {
    getListByBucket: jest.fn(),
    getAllWithExpiry: jest.fn(),
  },
}));

jest.mock('@/modules/audit/services/audit.service.js', () => ({
  emitAuditEvent: jest.fn(),
  AuditEventType: {
    OTHER: 'OTHER',
  },
}));

jest.mock('@/modules/sla/services/sla.service.js', () => ({
  getSLAReport: jest.fn(),
}));

import { runLeaveReportAlerts } from '@/modules/workforce-compliance/services/jobs/leave-report-alerts.job.js';
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';
import { AlertLogsRepository } from '@/modules/workforce-compliance/repositories/alert-logs.repository.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';

describe('runLeaveReportAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AlertLogsRepository.hasPayloadHash as jest.Mock).mockResolvedValue(false);
    (AlertLogsRepository.insertLog as jest.Mock).mockResolvedValue(1);
  });

  test('uses policy windows and sends notification for matched records', async () => {
    (WorkforceComplianceRepository.getLeaveReportCandidates as jest.Mock)
      .mockResolvedValueOnce([
        {
          leave_record_id: 101,
          citizen_id: '111',
          leave_type: 'ordain',
          end_date: '2026-02-01',
          days_since_end: 3,
        },
      ])
      .mockResolvedValueOnce([
        {
          leave_record_id: 202,
          citizen_id: '222',
          leave_type: 'military',
          end_date: '2026-02-01',
          days_since_end: 2,
        },
      ]);
    (WorkforceComplianceRepository.findUserIdByCitizenId as jest.Mock)
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(22);

    const result = await runLeaveReportAlerts();

    expect(WorkforceComplianceRepository.getLeaveReportCandidates).toHaveBeenNthCalledWith(
      1,
      ['ordain'],
      14,
      expect.any(Date),
    );
    expect(WorkforceComplianceRepository.getLeaveReportCandidates).toHaveBeenNthCalledWith(
      2,
      ['military'],
      15,
      expect.any(Date),
    );
    expect(NotificationService.notifyUserByTemplate).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(2);
  });

  test('marks overdue message using overdue-day policy', async () => {
    (WorkforceComplianceRepository.getLeaveReportCandidates as jest.Mock)
      .mockResolvedValueOnce([
        {
          leave_record_id: 303,
          citizen_id: '333',
          leave_type: 'ordain',
          end_date: '2026-02-01',
          days_since_end: 7,
        },
      ])
      .mockResolvedValueOnce([]);
    (WorkforceComplianceRepository.findUserIdByCitizenId as jest.Mock).mockResolvedValue(33);

    await runLeaveReportAlerts();

    expect(NotificationService.notifyUserByTemplate).toHaveBeenCalledWith(
      33,
      "WORKFORCE_LEAVE_REPORT_OVERDUE_USER",
      expect.objectContaining({
        daysSinceEnd: 7,
      }),
    );
  });

  test('skips deduped records and records no sent notification', async () => {
    (WorkforceComplianceRepository.getLeaveReportCandidates as jest.Mock)
      .mockResolvedValueOnce([
        {
          leave_record_id: 404,
          citizen_id: '444',
          leave_type: 'military',
          end_date: '2026-02-01',
          days_since_end: 3,
        },
      ])
      .mockResolvedValueOnce([]);
    (AlertLogsRepository.hasPayloadHash as jest.Mock).mockResolvedValue(true);

    const result = await runLeaveReportAlerts();

    expect(NotificationService.notifyUserByTemplate).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });
});
