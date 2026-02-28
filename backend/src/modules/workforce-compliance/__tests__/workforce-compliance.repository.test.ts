import type { RowDataPacket } from 'mysql2/promise';

const queryMock = jest.fn();
const executeMock = jest.fn();

jest.mock('@config/database.js', () => ({
  __esModule: true,
  default: {
    query: queryMock,
    execute: executeMock,
  },
}));

describe('WorkforceComplianceRepository manual movement guards', () => {
  beforeEach(() => {
    queryMock.mockReset();
    executeMock.mockReset();
  });

  test('lists only manual resign and transfer out rows', async () => {
    const mod = await import('../repositories/workforce-compliance.repository.js');
    queryMock.mockResolvedValue([[{ movement_id: 1 }] as RowDataPacket[]]);

    await mod.WorkforceComplianceRepository.getPersonnelMovements();

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("m.source_movement_id IS NULL"),
    );
  });

  test('updates only manual movement rows', async () => {
    const mod = await import('../repositories/workforce-compliance.repository.js');
    executeMock.mockResolvedValue([{ affectedRows: 1 }]);

    await mod.WorkforceComplianceRepository.updatePersonnelMovement(7, {
      citizen_id: '1234567890123',
      movement_type: 'RESIGN',
      effective_date: '2026-03-01',
      remark: 'manual',
    });

    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('source_movement_id IS NULL'),
      ['1234567890123', 'RESIGN', '2026-03-01', 'manual', 7],
    );
  });

  test('deletes only manual movement rows', async () => {
    const mod = await import('../repositories/workforce-compliance.repository.js');
    executeMock.mockResolvedValue([{ affectedRows: 1 }]);

    await mod.WorkforceComplianceRepository.deletePersonnelMovement(9);

    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('source_movement_id IS NULL'),
      [9],
    );
  });
});
