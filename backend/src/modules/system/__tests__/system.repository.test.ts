/**
 * System Repository Tests
 */

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

describe('SystemRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchUsers', () => {
    it('should sanitize LIKE wildcards in search term', async () => {
      const mockQuery = db.query as jest.Mock;
      mockQuery.mockResolvedValue([[]]);

      await SystemRepository.searchUsers('test%user_name');

      expect(mockQuery).toHaveBeenCalled();
      const callArgs = mockQuery.mock.calls[0];
      const searchParam = callArgs[1][0];

      // Should escape % and _ characters
      expect(searchParam).toContain('\\%');
      expect(searchParam).toContain('\\_');
    });

    it('should return user data with profile information', async () => {
      const mockUsers = [
        {
          id: 1,
          citizen_id: '1234567890123',
          role: 'USER',
          is_active: 1,
          last_login_at: new Date(),
          first_name: 'สมชาย',
          last_name: 'ใจดี',
        },
      ];

      const mockQuery = db.query as jest.Mock;
      mockQuery.mockResolvedValue([mockUsers]);

      const result = await SystemRepository.searchUsers('สมชาย');

      expect(result).toEqual(mockUsers);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT u.id'),
        expect.arrayContaining([expect.stringContaining('%สมชาย%')]),
      );
    });

    it('should limit results to 20', async () => {
      const mockQuery = db.query as jest.Mock;
      mockQuery.mockResolvedValue([[]]);

      await SystemRepository.searchUsers('test');

      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('LIMIT 20');
    });
  });

  describe('updateUserRole', () => {
    it('should update role in a transaction', async () => {
      const mockConn = {
        beginTransaction: jest.fn(),
        execute: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      const getConnection = require('@config/database.js').getConnection as jest.Mock;
      getConnection.mockResolvedValue(mockConn);

      await SystemRepository.updateUserRole(1, 'DIRECTOR', true);

      expect(mockConn.beginTransaction).toHaveBeenCalled();
      expect(mockConn.execute).toHaveBeenCalledTimes(2);
      expect(mockConn.commit).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });

    it('should only update role if is_active is undefined', async () => {
      const mockConn = {
        beginTransaction: jest.fn(),
        execute: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      const getConnection = require('@config/database.js').getConnection as jest.Mock;
      getConnection.mockResolvedValue(mockConn);

      await SystemRepository.updateUserRole(1, 'HEAD_DEPT', undefined);

      expect(mockConn.execute).toHaveBeenCalledTimes(1);
      expect(mockConn.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET role = ?'),
        ['HEAD_DEPT', 1],
      );
    });

    it('should rollback on error', async () => {
      const mockConn = {
        beginTransaction: jest.fn(),
        execute: jest.fn().mockRejectedValue(new Error('DB Error')),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      const getConnection = require('@config/database.js').getConnection as jest.Mock;
      getConnection.mockResolvedValue(mockConn);

      await expect(SystemRepository.updateUserRole(1, 'USER', false)).rejects.toThrow('DB Error');

      expect(mockConn.rollback).toHaveBeenCalled();
      expect(mockConn.release).toHaveBeenCalled();
    });
  });
});
