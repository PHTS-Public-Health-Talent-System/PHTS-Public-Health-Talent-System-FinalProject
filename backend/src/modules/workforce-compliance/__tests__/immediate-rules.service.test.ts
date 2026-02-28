jest.mock('@/modules/workforce-compliance/repositories/workforce-compliance.repository.js', () => ({
  WorkforceComplianceRepository: {
    getMovementOutCandidates: jest.fn(),
    setEligibilityExpiry: jest.fn(),
  },
}));

import { applyImmediateMovementEligibilityCutoff } from '@/modules/workforce-compliance/services/immediate-rules.service.js';
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';

describe('applyImmediateMovementEligibilityCutoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('formats cutoff date using ops timezone instead of UTC slicing', async () => {
    (WorkforceComplianceRepository.getMovementOutCandidates as jest.Mock).mockResolvedValue([
      {
        citizen_id: '1234567890123',
        movement_type: 'RESIGN',
        effective_date: '2026-02-28T17:30:00.000Z',
      },
    ]);
    (WorkforceComplianceRepository.setEligibilityExpiry as jest.Mock).mockResolvedValue(1);

    const result = await applyImmediateMovementEligibilityCutoff();

    expect(WorkforceComplianceRepository.setEligibilityExpiry).toHaveBeenCalledWith(
      '1234567890123',
      '2026-03-01',
      undefined,
    );
    expect(result).toEqual({ candidates: 1, cut: 1 });
  });
});
