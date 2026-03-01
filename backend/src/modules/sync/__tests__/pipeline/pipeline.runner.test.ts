import { TransformMonitorRepository } from '../../repositories/transform-monitor.repository.js';
import {
  runCoreStages,
  runPostStages,
} from '../../services/pipeline/pipeline.runner.js';
import type {
  PipelineContext,
  PipelineStageDefinition,
} from '../../services/pipeline/pipeline.types.js';

describe('sync pipeline runner policy', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const buildContext = (): PipelineContext =>
    ({
      mode: 'FULL',
      batchId: 999,
      triggeredBy: 1,
      conn: {} as any,
      stats: {} as any,
      transformEngine: {} as any,
      actions: {} as any,
    }) as PipelineContext;

  test('core stage failure throws and marks pipeline failed state', async () => {
    jest
      .spyOn(TransformMonitorRepository, 'startStageRun')
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    const finishSpy = jest
      .spyOn(TransformMonitorRepository, 'finishStageRun')
      .mockResolvedValue();
    const updateSpy = jest
      .spyOn(TransformMonitorRepository, 'updateBatchPipelineStatus')
      .mockResolvedValue();

    const stages: PipelineStageDefinition[] = [
      {
        key: 'sync-employee-profiles',
        group: 'CORE',
        run: async () => undefined,
      },
      {
        key: 'sync-support-staff',
        group: 'CORE',
        run: async () => {
          throw new Error('boom-core');
        },
      },
    ];

    await expect(
      runCoreStages({
        context: buildContext(),
        coreStages: stages,
      }),
    ).rejects.toThrow('boom-core');

    expect(finishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
      }),
    );
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        coreStatus: 'FAILED',
        overallStatus: 'FAILED',
      }),
    );
  });

  test('post stage failure keeps overall SUCCESS_WITH_WARNINGS', async () => {
    jest
      .spyOn(TransformMonitorRepository, 'startStageRun')
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(12);
    jest
      .spyOn(TransformMonitorRepository, 'finishStageRun')
      .mockResolvedValue();
    jest
      .spyOn(TransformMonitorRepository, 'updateBatchPipelineStatus')
      .mockResolvedValue();

    const postStages: PipelineStageDefinition[] = [
      {
        key: 'assign-roles',
        group: 'POST',
        run: async () => undefined,
      },
      {
        key: 'refresh-access-review',
        group: 'POST',
        run: async () => {
          throw new Error('boom-post');
        },
      },
    ];

    const summary = await runPostStages({
      context: buildContext(),
      postStages,
      previousStages: [
        {
          batch_id: 999,
          stage_key: 'sync-users',
          stage_group: 'CORE',
          status: 'SUCCESS',
        },
      ],
    });

    expect(summary.core_status).toBe('SUCCESS');
    expect(summary.post_status).toBe('FAILED');
    expect(summary.overall_status).toBe('SUCCESS_WITH_WARNINGS');
    expect(summary.stages.some((s) => s.stage_key === 'refresh-access-review' && s.status === 'FAILED')).toBe(true);
  });
});
