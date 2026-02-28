import type { PipelineStageDefinition } from '@/modules/sync/services/pipeline/pipeline.types.js';

export const syncSignaturesStage: PipelineStageDefinition = {
  key: 'sync-signatures',
  group: 'CORE',
  run: async (ctx) => ctx.actions.syncSignatures(ctx),
};
