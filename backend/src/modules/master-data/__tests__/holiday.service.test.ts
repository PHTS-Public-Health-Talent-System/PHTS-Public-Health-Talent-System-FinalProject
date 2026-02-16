import { AuditEventType } from '@/modules/audit/entities/audit.entity.js';

jest.mock('@/config/database.js', () => ({
  query: jest.fn(),
}));

jest.mock('@/modules/audit/services/audit.service.js', () => {
  const actual = jest.requireActual('@/modules/audit/services/audit.service.js');
  return {
    ...actual,
    emitAuditEvent: jest.fn(),
  };
});

import { query } from '@/config/database.js';
import { emitAuditEvent } from '@/modules/audit/services/audit.service.js';
import { deleteHoliday } from '../services/holiday.service.js';

describe('Holiday Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deleteHoliday deactivates by date-only match (supports DATETIME) and writes audit log', async () => {
    const date = '2026-02-15';
    const actorId = 99;

    (query as jest.Mock).mockResolvedValueOnce([]);

    await deleteHoliday(date, actorId);

    expect(query).toHaveBeenCalledWith(
      'UPDATE cfg_holidays SET is_active = 0 WHERE holiday_date = ? OR DATE(holiday_date) = ?',
      [date, date],
    );

    expect(emitAuditEvent).toHaveBeenCalledWith({
      eventType: AuditEventType.HOLIDAY_UPDATE,
      entityType: 'holiday',
      entityId: null,
      actorId,
      actorRole: null,
      actionDetail: {
        action: 'DEACTIVATE',
        holiday_date: date,
      },
    });
  });
});

