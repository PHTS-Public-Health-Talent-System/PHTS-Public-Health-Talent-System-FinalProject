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
import { deleteMasterRate } from '../services/rate.service.js';

describe("MasterData Rate Service", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deleteMasterRate marks rate inactive and writes audit log", async () => {
    const rateId = 123;
    const actorId = 99;

    (query as jest.Mock).mockResolvedValueOnce([]);

    await deleteMasterRate(rateId, actorId);

    expect(query).toHaveBeenCalledWith(
      "UPDATE cfg_payment_rates SET is_active = ? WHERE rate_id = ?",
      [0, rateId],
    );

    expect(emitAuditEvent).toHaveBeenCalledWith({
      eventType: AuditEventType.MASTER_RATE_UPDATE,
      entityType: "payment_rate",
      entityId: rateId,
      actorId,
      actorRole: null,
      actionDetail: {
        action: "delete",
      },
    });
  });
});
