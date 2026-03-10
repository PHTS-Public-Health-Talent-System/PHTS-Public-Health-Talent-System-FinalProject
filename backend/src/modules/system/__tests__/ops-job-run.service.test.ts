import { resetSystemModuleMocks } from './test-helpers.js';

jest.mock('@/modules/system/repositories/ops-job-runs.repository.js', () => ({
  OpsJobRunsRepository: {
    createRun: jest.fn().mockResolvedValue(101),
    finishRun: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('OpsJobRunService', () => {
  beforeEach(() => {
    resetSystemModuleMocks();
  });

  test('records successful run with summary', async () => {
    const { OpsJobRunsRepository } = await import('@/modules/system/repositories/ops-job-runs.repository.js');
    const { OpsJobRunService } = await import('@/modules/system/services/ops-job-run.service.js');

    const result = await OpsJobRunService.runTrackedJob({
      jobKey: 'sla',
      triggerSource: 'SCHEDULED',
      handler: async () => ({ status: 'SUCCESS', summary: { sent: 3 } }),
    });

    expect(OpsJobRunsRepository.createRun).toHaveBeenCalledWith({
      jobKey: 'sla',
      triggerSource: 'SCHEDULED',
    });
    expect(OpsJobRunsRepository.finishRun).toHaveBeenCalledWith({
      jobRunId: 101,
      status: 'SUCCESS',
      summary: { sent: 3 },
    });
    expect(result).toEqual({ status: 'SUCCESS', summary: { sent: 3 } });
  });

  test('records failed run and rethrows error', async () => {
    const { OpsJobRunsRepository } = await import('@/modules/system/repositories/ops-job-runs.repository.js');
    const { OpsJobRunService } = await import('@/modules/system/services/ops-job-run.service.js');

    await expect(
      OpsJobRunService.runTrackedJob({
        jobKey: 'license-auto-cut',
        triggerSource: 'SCHEDULED',
        handler: async () => {
          throw new Error('boom');
        },
      }),
    ).rejects.toThrow('boom');

    expect(OpsJobRunsRepository.finishRun).toHaveBeenCalledWith({
      jobRunId: 101,
      status: 'FAILED',
      errorMessage: 'boom',
    });
  });
});
