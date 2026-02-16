/**
 * Maintenance Service Tests
 */

import redis from '@config/redis.js';
import {
  setMaintenanceMode,
  isMaintenanceModeEnabled,
} from '@/modules/system/services/maintenance.service.js';

// Mock Redis
jest.mock('@config/redis.js', () => ({
  __esModule: true,
  default: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
}));

describe('Maintenance Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setMaintenanceMode', () => {
    it('should set maintenance mode to enabled in Redis', async () => {
      await setMaintenanceMode(true);
      expect(redis.set).toHaveBeenCalledWith('system:maintenance:enabled', '1');
    });

    it('should delete maintenance key when disabled', async () => {
      await setMaintenanceMode(false);
      expect(redis.del).toHaveBeenCalledWith('system:maintenance:enabled');
    });
  });

  describe('isMaintenanceModeEnabled', () => {
    it('should return true when maintenance is enabled', async () => {
      (redis.get as jest.Mock).mockResolvedValue('1');
      const result = await isMaintenanceModeEnabled();
      expect(result).toBe(true);
    });

    it('should return false when maintenance is disabled', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      const result = await isMaintenanceModeEnabled();
      expect(result).toBe(false);
    });

    it('should return false for any value other than "1"', async () => {
      (redis.get as jest.Mock).mockResolvedValue('0');
      const result = await isMaintenanceModeEnabled();
      expect(result).toBe(false);
    });
  });
});
