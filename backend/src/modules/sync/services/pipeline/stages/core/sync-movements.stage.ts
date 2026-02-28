import type { PipelineStageDefinition } from '@/modules/sync/services/pipeline/pipeline.types.js';

export const syncMovementsStage: PipelineStageDefinition = {
  key: 'sync-movements',
  group: 'CORE',
  run: async (ctx) => ctx.actions.syncMovements(ctx),
};
