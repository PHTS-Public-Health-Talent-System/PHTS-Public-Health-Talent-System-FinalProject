jest.mock('@/modules/notification/services/notification.service.js', () => ({
  NotificationService: {
    notifyUser: jest.fn(),
    notifyRole: jest.fn(),
  },
}));

jest.mock('@/modules/alerts/repositories/alert-logs.repository.js', () => ({
  AlertLogsRepository: {
    hasPayloadHash: jest.fn(),
    insertLog: jest.fn(),
  },
}));

jest.mock('@/modules/alerts/repositories/alerts.repository.js', () => ({
  AlertsRepository: {
    getLeaveReportCandidates: jest.fn(),
    findUserIdByCitizenId: jest.fn(),
    getRetirementsDue: jest.fn(),
    getMovementOutCandidates: jest.fn(),
    setEligibilityExpiry: jest.fn(),
    restoreLatestEligibility: jest.fn(),
  },
}));

jest.mock('@/modules/alerts/repositories/license-alerts.repository.js', () => ({
  LicenseAlertsRepository: {
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

import { runLeaveReportAlerts } from '@/modules/alerts/services/alert-jobs.service.js';
import { AlertsRepository } from '@/modules/alerts/repositories/alerts.repository.js';
import { AlertLogsRepository } from '@/modules/alerts/repositories/alert-logs.repository.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';

describe('runLeaveReportAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AlertLogsRepository.hasPayloadHash as jest.Mock).mockResolvedValue(false);
    (AlertLogsRepository.insertLog as jest.Mock).mockResolvedValue(1);
  });

  test('uses policy windows and sends notification for matched records', async () => {
    (AlertsRepository.getLeaveReportCandidates as jest.Mock)
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
    (AlertsRepository.findUserIdByCitizenId as jest.Mock)
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(22);

    const result = await runLeaveReportAlerts();

    expect(AlertsRepository.getLeaveReportCandidates).toHaveBeenNthCalledWith(
      1,
      ['ordain'],
      14,
      expect.any(Date),
    );
    expect(AlertsRepository.getLeaveReportCandidates).toHaveBeenNthCalledWith(
      2,
      ['military'],
      15,
      expect.any(Date),
    );
    expect(NotificationService.notifyUser).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(2);
  });

  test('marks overdue message using overdue-day policy', async () => {
    (AlertsRepository.getLeaveReportCandidates as jest.Mock)
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
    (AlertsRepository.findUserIdByCitizenId as jest.Mock).mockResolvedValue(33);

    await runLeaveReportAlerts();

    expect(NotificationService.notifyUser).toHaveBeenCalledWith(
      33,
      "แจ้งเตือนรายงานตัวกลับ (เกินกำหนด)",
      expect.stringContaining("ครบกำหนดรายงานตัวกลับจากการลาแล้ว"),
      "/dashboard/user/requests",
      "LEAVE",
    );
  });

  test('skips deduped records and records no sent notification', async () => {
    (AlertsRepository.getLeaveReportCandidates as jest.Mock)
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

    expect(NotificationService.notifyUser).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });
});
