import { requestCommandService } from '@/modules/request/services/command.service.js';
import { requestRepository } from '@/modules/request/repositories/request.repository.js';
import { getConnection } from '@config/database.js';
import { RequestStatus } from '@/modules/request/request.types.js';

jest.mock('@config/database.js', () => ({
  getConnection: jest.fn(),
}));

jest.mock('@shared/utils/profession.js', () => ({
  resolveProfessionCode: jest.fn(() => 'NURSE'),
}));

describe('RequestCommandService.updateRateMapping authorization', () => {
  const conn = {
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getConnection as jest.Mock).mockResolvedValue(conn);
    jest.spyOn(requestRepository, 'findRateByDetails').mockResolvedValue({
      rate_id: 1,
      amount: 1000,
      group_no: 1,
      item_no: '1',
      sub_item_no: null,
    } as any);
    jest.spyOn(requestRepository, 'update').mockResolvedValue(undefined as any);
  });

  it('rejects non-owner and non-PTS_OFFICER from updating rate mapping', async () => {
    jest.spyOn(requestRepository, 'findById').mockResolvedValue({
      request_id: 77,
      user_id: 99,
      status: RequestStatus.DRAFT,
      current_step: 1,
      position_name: 'พยาบาลวิชาชีพ',
      submission_data: null,
    } as any);

    await expect(
      requestCommandService.updateRateMapping(
        77,
        12,
        'USER',
        { group_no: 1, item_no: '1', sub_item_no: null },
      ),
    ).rejects.toThrow();
  });
});
