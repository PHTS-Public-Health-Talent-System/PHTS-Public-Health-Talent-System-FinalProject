import type { PipelineStageDefinition } from '@/modules/sync/services/pipeline/pipeline.types.js';

export const syncLeavesStage: PipelineStageDefinition = {
  key: 'sync-leaves',
  group: 'CORE',
  run: async (ctx) => ctx.actions.syncLeaves(ctx),
};
