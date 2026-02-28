import { TransformMonitorRepository } from '@/modules/sync/repositories/transform-monitor.repository.js';
import type {
  PipelineContext,
  PipelineExecutionSummary,
  PipelineStageDefinition,
  StageExecutionResult,
} from '@/modules/sync/services/pipeline/pipeline.types.js';

const runSingleStage = async (
  ctx: PipelineContext,
  stage: PipelineStageDefinition,
): Promise<StageExecutionResult> => {
  const startedAt = new Date();
  const started = Date.now();
  const stageRunId = await TransformMonitorRepository.startStageRun({
    batchId: ctx.batchId,
    stageKey: stage.key,
    stageGroup: stage.group,
  });

  try {
    const stageResult = await stage.run(ctx);
    const status = stageResult?.skipped ? 'SKIPPED' : 'SUCCESS';
    const finishedAt = new Date();
    const durationMs = Date.now() - started;
    await TransformMonitorRepository.finishStageRun({
      stageRunId,
      status,
      durationMs,
    });
    return {
      stage_run_id: stageRunId,
      batch_id: ctx.batchId,
      stage_key: stage.key,
      stage_group: stage.group,
      status,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: durationMs,
      warning: stageResult?.warning ?? null,
      payload: stageResult?.payload,
    };
  } catch (error) {
    const finishedAt = new Date();
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    await TransformMonitorRepository.finishStageRun({
      stageRunId,
      status: 'FAILED',
      errorMessage: message,
      durationMs,
    });
    return {
      stage_run_id: stageRunId,
      batch_id: ctx.batchId,
      stage_key: stage.key,
      stage_group: stage.group,
      status: 'FAILED',
      error_message: message,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: durationMs,
    };
  }
};

const countWarnings = (stages: StageExecutionResult[]): number =>
  stages.reduce((acc, stage) => acc + (stage.warning ? 1 : 0), 0);

export const runCoreStages = async (input: {
  context: PipelineContext;
  coreStages: PipelineStageDefinition[];
}): Promise<StageExecutionResult[]> => {
  const { context, coreStages } = input;
  const stageResults: StageExecutionResult[] = [];

  await TransformMonitorRepository.updateBatchPipelineStatus({
    batchId: context.batchId,
    coreStatus: 'RUNNING',
    postStatus: 'PENDING',
    overallStatus: 'RUNNING',
    warningsCount: 0,
  });

  for (const stage of coreStages) {
    const result = await runSingleStage(context, stage);
    stageResults.push(result);
    if (result.status === 'FAILED') {
      await TransformMonitorRepository.updateBatchPipelineStatus({
        batchId: context.batchId,
        coreStatus: 'FAILED',
        postStatus: 'PENDING',
        overallStatus: 'FAILED',
        warningsCount: 0,
      });
      throw new Error(result.error_message ?? `Core stage failed: ${result.stage_key}`);
    }
  }

  await TransformMonitorRepository.updateBatchPipelineStatus({
    batchId: context.batchId,
    coreStatus: 'SUCCESS',
    postStatus: 'RUNNING',
    overallStatus: 'RUNNING',
  });

  return stageResults;
};

export const runPostStages = async (input: {
  context: PipelineContext;
  postStages: PipelineStageDefinition[];
  previousStages?: StageExecutionResult[];
}): Promise<PipelineExecutionSummary> => {
  const { context, postStages, previousStages = [] } = input;
  const stageResults: StageExecutionResult[] = [...previousStages];
  let postFailed = false;
  for (const stage of postStages) {
    const result = await runSingleStage(context, stage);
    stageResults.push(result);
    if (result.status === 'FAILED') postFailed = true;
  }

  const warningsCount = countWarnings(stageResults);
  const summary: PipelineExecutionSummary = {
    core_status: 'SUCCESS',
    post_status: postFailed ? 'FAILED' : 'SUCCESS',
    overall_status: postFailed ? 'SUCCESS_WITH_WARNINGS' : 'SUCCESS',
    warnings_count: warningsCount,
    stages: stageResults,
  };

  await TransformMonitorRepository.updateBatchPipelineStatus({
    batchId: context.batchId,
    coreStatus: summary.core_status,
    postStatus: summary.post_status,
    overallStatus: summary.overall_status,
    warningsCount: summary.warnings_count,
  });

  return summary;
};
